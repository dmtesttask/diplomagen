import type { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AuthedRequest extends Request {
  uid: string;
}

/**
 * Express middleware that verifies the Firebase ID token from the
 * Authorization header and attaches the decoded UID to the request.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as AuthedRequest).uid = decodedToken.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired ID token.' });
  }
}
