import { Router, type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createError } from '../middleware/error-handler';
import type { AuthedRequest } from '../middleware/authenticate';
import { generateUploadSignedUrl, uploadBuffer, downloadFileAsBuffer, deleteFile, IS_EMULATOR } from '../services/storage.service';
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
      id: doc.id,
      ...doc.data(),
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

    res.json({ id: snap.id, ...snap.data() });
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
      return next(createError(400, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const now = Timestamp.now();
    const docRef = projectsRef(uid).doc();

    const project = {
      name: parsed.data.name,
      ownerId: uid,
      template: null,
      fields: [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(project);
    res.status(201).json({ id: docRef.id, ...project });
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
      return next(createError(400, parsed.error.message, 'VALIDATION_ERROR'));
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
    res.json({ id: updated.id, ...updated.data() });
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
      return next(createError(400, parsed.error.message, 'VALIDATION_ERROR'));
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
  req.pipe(bb);
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
      return next(createError(400, parsed.error.message, 'VALIDATION_ERROR'));
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
