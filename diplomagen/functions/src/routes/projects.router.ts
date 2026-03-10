import { Router, type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { createError } from '../middleware/error-handler';
import type { AuthedRequest } from '../middleware/authenticate';
import { generateUploadSignedUrl, generateDownloadSignedUrl, uploadBuffer, downloadFileAsBuffer, deleteFile, IS_EMULATOR } from '../services/storage.service';
import busboy from 'busboy';

interface TemplateMetadata {
  storageUrl: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

export const projectsRouter = Router();

const db = () => admin.firestore();

// ─── Validation Schemas ───────────────────────────────────────────────────────
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function projectRef(uid: string, projectId: string) {
  return db().collection('users').doc(uid).collection('projects').doc(projectId);
}

function projectsRef(uid: string) {
  return db().collection('users').doc(uid).collection('projects');
}

// ─── GET /projects ────────────────────────────────────────────────────────────
projectsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const snapshot = await projectsRef(uid)
      .orderBy('updatedAt', 'desc')
      .get();

    const projects = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:id ────────────────────────────────────────────────────────
projectsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const snap = await projectRef(uid, req.params['id']).get();

    if (!snap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    // id comes last so it can never be overridden by document-stored data
    res.json({ ...snap.data(), id: snap.id });
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects ───────────────────────────────────────────────────────────
projectsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const now = Timestamp.now();
    const docRef = projectsRef(uid).doc();

    const project = {
      name: parsed.data.name,
      ownerId: uid,
      template: null,
      fields: [],
      excelColumns: [],
      excelDataPath: null,
      totalRows: null,
      columnMaxValues: null,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(project);
    res.status(201).json({ ...project, id: docRef.id });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /projects/:id ──────────────────────────────────────────────────────
projectsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const ref = projectRef(uid, req.params['id']);
    const snap = await ref.get();
    if (!snap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (parsed.data.name !== undefined) updates['name'] = parsed.data.name;

    await ref.update(updates);

    const updated = await ref.get();
    res.json({ ...updated.data(), id: updated.id });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /projects/:id ─────────────────────────────────────────────────────
projectsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const ref = projectRef(uid, req.params['id']);
    const snap = await ref.get();

    if (!snap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    // Delete template file from GCS if it exists
    const data = snap.data() as { template?: TemplateMetadata | null };
    if (data?.template?.storageUrl) {
      await deleteFile(data.template.storageUrl).catch(() => { /* ignore */ });
    }

    // Delete all sub-collections (jobs) before deleting the project doc
    const jobsSnap = await ref.collection('jobs').get();
    const batch = db().batch();
    jobsSnap.forEach((doc) => batch.delete(doc.ref));
    batch.delete(ref);
    await batch.commit();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects/:id/upload-url ───────────────────────────────────────────
const UploadUrlSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  extension: z.string().max(5),
});

projectsRouter.post('/:id/upload-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = UploadUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const snap = await projectRef(uid, req.params['id']).get();
    if (!snap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    const { mimeType, extension } = parsed.data;
    const gcsPath = `templates/${uid}/${req.params['id']}/template.${extension}`;

    // In emulator, signed URLs are not supported — tell the client to use /upload instead
    if (IS_EMULATOR) {
      return res.json({ uploadUrl: null, gcsPath, useDirectUpload: true });
    }

    const uploadUrl = await generateUploadSignedUrl(gcsPath, mimeType);
    res.json({ uploadUrl, gcsPath, useDirectUpload: false });
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects/:id/upload (emulator-only direct upload) ────────────────────
projectsRouter.post('/:id/upload', (req: Request, res: Response, next: NextFunction) => {
  const { uid } = req as AuthedRequest;
  const extension = (req.query['ext'] as string) ?? 'jpg';
  const projectId = req.params['id'];
  const gcsPath = `templates/${uid}/${projectId}/template.${extension}`;

  const chunks: Buffer[] = [];
  let mimeType = 'application/octet-stream';

  const bb = busboy({ headers: req.headers });

  bb.on('file', (_name: string, file: NodeJS.ReadableStream, info: { mimeType: string }) => {
    mimeType = info.mimeType;
    (file as NodeJS.ReadableStream & {on: (event:string, cb: (chunk:Buffer)=>void)=>void}).on('data', (chunk: Buffer) => chunks.push(chunk));
  });

  bb.on('finish', () => {
    const buffer = Buffer.concat(chunks);
    projectRef(uid, projectId).get()
      .then(snap => {
        if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));
        return uploadBuffer(gcsPath, buffer, mimeType);
      })
      .then(() => res.json({ gcsPath, mimeType }))
      .catch(next);
  });

  bb.on('error', next);

  // Firebase Functions pre-buffers the request body (available as req.rawBody).
  // Piping `req` directly fails because the stream is already fully consumed by
  // the time the route handler runs. Use rawBody when present; fall back to
  // piping the live stream in plain Node environments (e.g. integration tests).
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (rawBody) {
    const readable = new Readable();
    readable.push(rawBody);
    readable.push(null);
    readable.pipe(bb);
  } else {
    req.pipe(bb);
  }
});

// ─── GET /projects/:id/template/signed-url ──────────────────────────────────
projectsRouter.get('/:id/template/signed-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const snap = await projectRef(uid, req.params['id']).get();
    if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

    const data = snap.data() as { template?: TemplateMetadata | null };
    if (!data?.template?.storageUrl) {
      return next(createError(404, 'No template uploaded.', 'NOT_FOUND'));
    }

    const signedUrl = await generateDownloadSignedUrl(data.template.storageUrl);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    res.json({ signedUrl, expiresAt });
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:id/template/content (image proxy — works in emulator & prod) ─────
projectsRouter.get('/:id/template/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const snap = await projectRef(uid, req.params['id']).get();
    if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

    const data = snap.data() as { template?: TemplateMetadata | null };
    if (!data?.template?.storageUrl) {
      return next(createError(404, 'No template uploaded.', 'NOT_FOUND'));
    }

    const buffer = await downloadFileAsBuffer(data.template.storageUrl);
    res.set('Content-Type', data.template.mimeType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects/:id/template ─────────────────────────────────────────────
const ConfirmTemplateSchema = z.object({
  gcsPath: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
});

projectsRouter.post('/:id/template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = ConfirmTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const ref = projectRef(uid, req.params['id']);
    const snap = await ref.get();
    if (!snap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    // Delete old template from GCS if replacing
    const existing = snap.data() as { template?: TemplateMetadata | null };
    if (existing?.template?.storageUrl && existing.template.storageUrl !== parsed.data.gcsPath) {
      await deleteFile(existing.template.storageUrl).catch(() => { /* ignore */ });
    }

    const { gcsPath, mimeType } = parsed.data;
    const buffer = await downloadFileAsBuffer(gcsPath);

    let widthPx: number;
    let heightPx: number;

    if (mimeType === 'application/pdf') {
      const pdfDoc = await PDFDocument.load(buffer);
      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize();
      // PDF points to pixels at 96 DPI: 1 pt = 96/72 px
      widthPx = Math.round(width * (96 / 72));
      heightPx = Math.round(height * (96 / 72));
    } else {
      const meta = await sharp(buffer).metadata();
      widthPx = meta.width ?? 0;
      heightPx = meta.height ?? 0;
    }

    const template: TemplateMetadata = { storageUrl: gcsPath, mimeType, widthPx, heightPx };

    await ref.update({
      template,
      fields: [], // reset fields when template changes
      updatedAt: Timestamp.now(),
    });

    res.json(template);
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects/:id/excel ─────────────────────────────────────────────────
projectsRouter.post('/:id/excel', (req: Request, res: Response, next: NextFunction) => {
  const { uid } = req as AuthedRequest;
  const projectId = req.params['id'];

  const chunks: Buffer[] = [];
  let validationFailed = false;

  const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });

  bb.on('file', (_fieldName: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
    const { filename } = info;
    if (!/\.(xlsx|xls)$/i.test(filename)) {
      validationFailed = true;
      next(createError(422, 'Only .xlsx and .xls files are accepted.', 'VALIDATION_ERROR'));
      return;
    }
    (file as NodeJS.ReadableStream & { on: (e: string, cb: (d: Buffer) => void) => void })
      .on('data', (chunk: Buffer) => chunks.push(chunk));
    (file as NodeJS.ReadableStream & { on: (e: string, cb: () => void) => void })
      .on('limit', () => {
        validationFailed = true;
        next(createError(422, 'Excel file must be ≤ 10 MB.', 'VALIDATION_ERROR'));
      });
  });

  bb.on('finish', async () => {
    if (validationFailed) return;
    try {
      const snap = await projectRef(uid, projectId).get();
      if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) return next(createError(422, 'No file received.', 'VALIDATION_ERROR'));

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return next(createError(422, 'Excel file has no sheets.', 'VALIDATION_ERROR'));

      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
        workbook.Sheets[sheetName],
        { defval: '' },
      );
      if (rows.length === 0) return next(createError(422, 'Excel file has no data rows.', 'VALIDATION_ERROR'));

      const columns: string[] = Object.keys(rows[0]);
      const totalRows: number = rows.length;
      const preview: Record<string, string>[] = rows.slice(0, 5) as Record<string, string>[];

      // Compute the longest value per column for editor canvas preview
      const columnMaxValues: Record<string, string> = {};
      for (const col of columns) {
        let longest = '';
        for (const row of rows as Record<string, string>[]) {
          const val = String(row[col] ?? '');
          if (val.length > longest.length) longest = val;
        }
        columnMaxValues[col] = longest;
      }

      const dataPath = `data/${uid}/${projectId}/participants.json`;
      await uploadBuffer(dataPath, Buffer.from(JSON.stringify(rows), 'utf-8'), 'application/json');

      // Reset excelColumn mapping on all existing fields
      const projectData = snap.data() as { fields?: Array<Record<string, unknown>> };
      const updatedFields = (projectData.fields ?? []).map((f) => ({ ...f, excelColumn: null }));

      await projectRef(uid, projectId).update({
        excelColumns: columns,
        excelDataPath: dataPath,
        totalRows,
        columnMaxValues,
        fields: updatedFields,
        updatedAt: Timestamp.now(),
      });

      res.json({ columns, totalRows, preview });
    } catch (err) {
      next(err);
    }
  });

  bb.on('error', next);

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (rawBody) {
    const readable = new Readable();
    readable.push(rawBody);
    readable.push(null);
    readable.pipe(bb);
  } else {
    req.pipe(bb);
  }
});

// ─── PATCH /projects/:id/fields ───────────────────────────────────────────────
const FieldStyleSchema = z.object({
  fontFamily: z.enum(['PTSerif', 'PTSans', 'Roboto', 'OpenSans', 'TimesNewRoman']),
  fontSize: z.number().min(1).max(500),
  color: z.string(),
  bold: z.boolean(),
  italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']),
});

const FieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  excelColumn: z.string().nullable().optional(),
  staticValue: z.string().nullable().optional(),
  position: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
  style: FieldStyleSchema,
});

const UpdateFieldsSchema = z.object({
  fields: z.array(FieldSchema).max(20),
});

projectsRouter.patch('/:id/fields', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = UpdateFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const ref = projectRef(uid, req.params['id']);
    const snap = await ref.get();
    if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

    await ref.update({ fields: parsed.data.fields, updatedAt: Timestamp.now() });

    const updated = await ref.get();
    res.json({ ...updated.data(), id: updated.id });
  } catch (err) {
    next(err);
  }
});
