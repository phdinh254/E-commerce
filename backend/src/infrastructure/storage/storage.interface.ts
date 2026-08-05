export interface UploadFileInput {
  path: string;
  buffer: Buffer;
  contentType: string;
  /** e.g. `'3600'` — passed through to Supabase's Cache-Control header. */
  cacheControl?: string;
}

export interface UploadFileResult {
  path: string;
  bucket: string;
}

/**
 * Thrown when Supabase Storage itself is not configured or the operation
 * failed for an infrastructure reason (network, credentials, bucket
 * missing) — callers map this to 503, never to a 400/409 "your file is
 * invalid" response. Distinguish from `StorageConflictError` below.
 */
export class StorageUnavailableError extends Error {}

/** Thrown when `upsert: false` collided with an existing object at the same path. */
export class StorageConflictError extends Error {}

export interface StorageProvider {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  remove(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  /** The bucket this provider is bound to — for persisting alongside `object_path` in the DB. */
  getBucketName(): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
