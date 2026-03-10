import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import { type Writable } from 'stream';

export const BUCKET_NAME =
  process.env['STORAGE_BUCKET'] ??
  `${process.env['GCLOUD_PROJECT']}.firebasestorage.app`;

/** True when running inside the Firebase Emulator Suite */
export const IS_EMULATOR = !!process.env['FIREBASE_STORAGE_EMULATOR_HOST'];

/**
 * Returns the GCS bucket, routing to the Storage emulator when running locally.
 * admin.storage() automatically honours FIREBASE_STORAGE_EMULATOR_HOST, while
 * `new Storage()` (the raw GCP client) does not.
 */
function getBucket() {
  return admin.storage().bucket(BUCKET_NAME);
}

/**
 * Raw @google-cloud/storage client — only used for V4 signed URLs in production
 * (the Admin SDK does not expose signed URL generation directly).
 */
const gcsClient = new Storage();

/**
 * Generates a V4 signed URL so the client can upload directly to GCS.
 * Only usable in production (not in the emulator).
 */
export async function generateUploadSignedUrl(
  gcsPath: string,
  mimeType: string,
): Promise<string> {
  const [url] = await gcsClient
    .bucket(BUCKET_NAME)
    .file(gcsPath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: mimeType,
    });
  return url;
}

/**
 * Uploads a Buffer directly to GCS via the Admin SDK.
 * Used as the emulator-friendly alternative to signed URLs.
 */
export async function uploadBuffer(
  gcsPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  await getBucket().file(gcsPath).save(buffer, {
    contentType: mimeType,
    resumable: false,
  });
}

/**
 * Downloads a file from GCS into a Buffer for processing.
 */
export async function downloadFileAsBuffer(gcsPath: string): Promise<Buffer> {
  const [buffer] = await getBucket().file(gcsPath).download();
  return buffer;
}

/**
 * Generates a V4 signed URL so the client can download a file from GCS.
 * In the emulator, returns a plain emulator URL instead.
 */
export async function generateDownloadSignedUrl(
  gcsPath: string,
  expiresInMs = 60 * 60 * 1000, // 1 hour
): Promise<string> {
  if (IS_EMULATOR) {
    const encoded = encodeURIComponent(gcsPath);
    return `http://localhost:9199/v0/b/${BUCKET_NAME}/o/${encoded}?alt=media`;
  }
  const [url] = await gcsClient
    .bucket(BUCKET_NAME)
    .file(gcsPath)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMs,
    });
  return url;
}

/**
 * Returns a writable stream that pipes data directly into GCS,
 * plus a promise that resolves when the upload finishes.
 * Use this for large files (e.g. ZIP archives) to avoid buffering the entire
 * payload in memory and to bypass HTTP payload-size limits in the emulator.
 */
export function createUploadStream(
  gcsPath: string,
  mimeType: string,
): { stream: Writable; done: Promise<void> } {
  const file = getBucket().file(gcsPath);
  const stream = file.createWriteStream({
    contentType: mimeType,
    resumable: true,   // multipart/resumable avoids single-request size limits
    validation: false, // skip CRC32c/MD5 check for throughput
  });
  const done = new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return { stream, done };
}

/**
 * Deletes a file from GCS. Does not throw if the file does not exist.
 */
export async function deleteFile(gcsPath: string): Promise<void> {
  try {
    await getBucket().file(gcsPath).delete();
  } catch (err: unknown) {
    // Ignore "File not found" errors
    const code = (err as { code?: number }).code;
    if (code !== 404) throw err;
  }
}

