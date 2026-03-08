import type { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Centralized error handler middleware. Must be registered LAST in Express.
 * Formats all errors into a consistent JSON response shape.
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = err.status ?? 500;
  const message = err.message ?? 'Internal Server Error';

  console.error(`[${req.method}] ${req.path} → ${status}: ${message}`, err.stack);

  res.status(status).json({
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message,
    },
  });
}

/** Helper: create a typed API error with status code */
export function createError(status: number, message: string, code?: string): ApiError {
  const err: ApiError = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
