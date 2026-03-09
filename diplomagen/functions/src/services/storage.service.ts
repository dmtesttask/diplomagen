import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export const BUCKET_NAME = process.env['STORAGE_BUCKET'] ?? `${process.env['GCLOUD_PROJECT']}.firebasestorage.app`;

/** True when running inside the Firebase Emulator Suite */
export const IS_EMULATOR = !!process.env['FIREBASE_STORAGE_EMULATOR_HOST'];

/**
 * Generates a V4 signed URL so the client can upload directly to GCS.
 * Only usable in production (not in the emulator).
 */
export async function generateUploadSignedUrl(
  gcsPath: string,
  mimeType: string,
): Promise<string> {
  const [url] = await storage
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
  await storage.bucket(BUCKET_NAME).file(gcsPath).save(buffer, {
    contentType: mimeType,
    resumable: false,
  });
}

/**
 * Downloads a file from GCS into a Buffer for processing.
 */
export async function downloadFileAsBuffer(gcsPath: string): Promise<Buffer> {
  const [buffer] = await storage.bucket(BUCKET_NAME).file(gcsPath).download();
  return buffer;
}

/**
 * Deletes a file from GCS. Does not throw if the file does not exist.
 */
export async function deleteFile(gcsPath: string): Promise<void> {
  try {
    await storage.bucket(BUCKET_NAME).file(gcsPath).delete();
  } catch (err: unknown) {
    // Ignore "File not found" errors
    const code = (err as { code?: number }).code;
    if (code !== 404) throw err;
  }
}

