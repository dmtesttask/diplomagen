/**
 * generate.router.ts
 * Handles:
 *   POST /projects/:id/generate          → trigger batch diploma generation
 *   GET  /projects/:id/jobs              → list generation jobs for a project
 *   GET  /projects/:id/jobs/:jobId/download → get a signed URL for the ZIP
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import archiver from 'archiver';
import { createError } from '../middleware/error-handler';
import type { AuthedRequest } from '../middleware/authenticate';
import {
  downloadFileAsBuffer,
  createUploadStream,
} from '../services/storage.service';
import { generateDiplomaPdf, type TemplateInfo, type Field, type PdfmeSchemaRecord } from '../services/pdf.service';

export const generateRouter = Router();

const db = () => admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectRef(uid: string, projectId: string) {
  return db().collection('users').doc(uid).collection('projects').doc(projectId);
}

function jobRef(uid: string, projectId: string, jobId: string) {
  return db()
    .collection('users').doc(uid)
    .collection('projects').doc(projectId)
    .collection('jobs').doc(jobId);
}

function jobsRef(uid: string, projectId: string) {
  return db()
    .collection('users').doc(uid)
    .collection('projects').doc(projectId)
    .collection('jobs');
}

// ─── Background generation (fire-and-forget) ─────────────────────────────────

async function runGenerationJob(
  uid: string,
  projectId: string,
  currentJobId: string,
): Promise<void> {
  const jRef = jobRef(uid, projectId, currentJobId);

  try {
    // Mark as processing
    await jRef.update({ status: 'processing' });

    // Load project
    const projectSnap = await projectRef(uid, projectId).get();
    if (!projectSnap.exists) throw new Error('Project not found.');
    const project = projectSnap.data() as {
      name: string;
      template: (TemplateInfo & { storageUrl: string }) | null;
      fields: Field[];
      pdfmeSchemas: PdfmeSchemaRecord[] | null;
      excelDataPath: string | null;
      totalRows: number | null;
    };

    if (!project.template) throw new Error('No template found on project.');
    if (!project.pdfmeSchemas || project.pdfmeSchemas.length === 0) {
      throw new Error('No field layout found. Open the editor and place the fields first.');
    }
    if (!project.excelDataPath) throw new Error('No Excel data found on project.');

    // Load template bytes
    const templateBuffer = await downloadFileAsBuffer(project.template.storageUrl);

    // Load participant data JSON
    const dataBuffer = await downloadFileAsBuffer(project.excelDataPath);
    const rows: Record<string, string>[] = JSON.parse(dataBuffer.toString('utf-8')) as Record<string, string>[];

    const totalCount = rows.length;
    const zipPath = `zips/${uid}/${projectId}/${currentJobId}.zip`;

    // Stream each PDF directly into archiver → GCS write stream.
    // This keeps only ONE pdf buffer in memory at a time and never
    // accumulates the full ZIP payload, avoiding PayloadTooLargeError.
    const { stream: zipStream, done: zipDone } = createUploadStream(zipPath, 'application/zip');
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => { zipStream.destroy(err as unknown as Error); });
    archive.pipe(zipStream);

    let processedCount = 0;
    for (const row of rows) {
      const pdfBuffer = await generateDiplomaPdf(
        templateBuffer,
        project.template,
        project.pdfmeSchemas,
        project.fields,
        row,
      );
      archive.append(pdfBuffer, { name: `diploma_${processedCount + 1}.pdf` });
      processedCount++;

      // Periodically persist progress (every 10 diplomas or on last one)
      if (processedCount % 10 === 0 || processedCount === totalCount) {
        await jRef.update({ processedCount }).catch(() => { /* non-critical */ });
      }
    }

    // Seal the archive and wait for GCS to confirm the upload is complete
    await archive.finalize();
    await zipDone;

    // Deduct from user balance (transaction)
    const userRef = db().collection('users').doc(uid);
    await db().runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) return;
      const userData = userSnap.data() as { availableGenerations?: number };
      const current = userData.availableGenerations ?? 0;
      t.update(userRef, {
        availableGenerations: Math.max(0, current - processedCount),
      });
    });

    // Mark done
    await jRef.update({
      status: 'done',
      processedCount,
      zipStorageUrl: zipPath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await jRef.update({
      status: 'error',
      errorMessage: message,
    }).catch(() => { /* swallow secondary failure */ });
  }
}

// ─── POST /projects/:id/generate ─────────────────────────────────────────────

generateRouter.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const projectId = req.params['id'];

    // Load project
    const pSnap = await projectRef(uid, projectId).get();
    if (!pSnap.exists) {
      return next(createError(404, 'Project not found.', 'NOT_FOUND'));
    }

    const project = pSnap.data() as {
      template: (TemplateInfo & { storageUrl: string }) | null;
      excelDataPath: string | null;
      totalRows: number | null;
      fields: Field[];
      pdfmeSchemas: PdfmeSchemaRecord[] | null;
    };

    // Validate prerequisites
    if (!project.template) {
      return next(createError(422, 'Upload a template before generating.', 'PRECONDITION_FAILED'));
    }
    if (!project.excelDataPath) {
      return next(createError(422, 'Upload an Excel file before generating.', 'PRECONDITION_FAILED'));
    }
    if (!project.pdfmeSchemas || project.pdfmeSchemas.length === 0) {
      return next(createError(422, 'Place at least one field on the canvas before generating.', 'PRECONDITION_FAILED'));
    }

    const totalCount = project.totalRows ?? 0;
    if (totalCount === 0) {
      return next(createError(422, 'Excel file has no participant rows.', 'PRECONDITION_FAILED'));
    }

    // Check user balance
    const userSnap = await db().collection('users').doc(uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() as { availableGenerations?: number };
      const balance = userData.availableGenerations ?? 0;
      if (balance < totalCount) {
        return next(
          createError(
            402,
            `Insufficient balance. Need ${totalCount} generation(s), have ${balance}.`,
            'INSUFFICIENT_BALANCE',
          ),
        );
      }
    }

    // Create job document
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    const jRef = jobsRef(uid, projectId).doc();

    await jRef.set({
      projectId,
      status: 'pending',
      totalCount,
      processedCount: 0,
      zipStorageUrl: null,
      errorMessage: null,
      createdAt: now,
      expiresAt,
    });

    const jobId = jRef.id;

    // Respond immediately — generation runs in background
    res.status(202).json({ jobId, totalCount, status: 'pending' });

    // Fire-and-forget (do NOT await — must be after res.json)
    setImmediate(() => {
      runGenerationJob(uid, projectId, jobId).catch((err: unknown) => {
        console.error('[generate] Background job error:', err);
      });
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:id/jobs ───────────────────────────────────────────────────

generateRouter.get('/:id/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const projectId = req.params['id'];

    const pSnap = await projectRef(uid, projectId).get();
    if (!pSnap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

    const snapshot = await jobsRef(uid, projectId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const jobs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:id/jobs/:jobId/download ─────────────────────────────────
// Proxies the ZIP binary through the authenticated API so the client does not
// need a separate (often auth-gated) Storage URL.

generateRouter.get(
  '/:id/jobs/:jobId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uid } = req as AuthedRequest;
      const { id: projectId, jobId } = req.params as { id: string; jobId: string };

      const jSnap = await jobRef(uid, projectId, jobId).get();
      if (!jSnap.exists) return next(createError(404, 'Job not found.', 'NOT_FOUND'));

      const job = jSnap.data() as {
        status: string;
        zipStorageUrl: string | null;
        expiresAt: { toMillis: () => number };
      };

      if (job.status !== 'done') {
        return next(createError(409, 'Diplomas are not ready yet.', 'JOB_NOT_DONE'));
      }
      if (!job.zipStorageUrl) {
        return next(createError(404, 'ZIP file not found.', 'NOT_FOUND'));
      }

      // Check expiry
      const expiresMs = typeof job.expiresAt?.toMillis === 'function'
        ? job.expiresAt.toMillis()
        : Number(job.expiresAt);

      if (expiresMs < Date.now()) {
        return next(createError(410, 'This ZIP has expired. Please regenerate.', 'ZIP_EXPIRED'));
      }

      // Stream the ZIP bytes through the authenticated Cloud Function response.
      // This works in both the emulator and production without needing a separate
      // Storage signed URL (which requires the emulator to be publicly accessible).
      const buffer = await downloadFileAsBuffer(job.zipStorageUrl);
      res.set('Content-Type', 'application/zip');
      res.set('Content-Length', String(buffer.length));
      res.set(
        'Content-Disposition',
        `attachment; filename="diplomas_${projectId}.zip"`,
      );
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /projects/:id/jobs/:jobId (single job status) ────────────────────────

generateRouter.get(
  '/:id/jobs/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uid } = req as AuthedRequest;
      const { id: projectId, jobId } = req.params as { id: string; jobId: string };

      const jSnap = await jobRef(uid, projectId, jobId).get();
      if (!jSnap.exists) return next(createError(404, 'Job not found.', 'NOT_FOUND'));

      res.json({ ...jSnap.data(), id: jSnap.id });
    } catch (err) {
      next(err);
    }
  },
);
