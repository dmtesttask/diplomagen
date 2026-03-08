import { Router, type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createError } from '../middleware/error-handler';
import type { AuthedRequest } from '../middleware/authenticate';

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

    // TODO: Epic 8 — also delete GCS files (template, data, generated zips)
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
