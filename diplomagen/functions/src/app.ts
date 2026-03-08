import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/error-handler';
import { projectsRouter } from './routes/projects.router';

export const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }),
);

app.use(express.json({ limit: '1mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Authenticated Routes ─────────────────────────────────────────────────────
app.use(authenticate);
app.use('/projects', projectsRouter);

// ─── Error Handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);
