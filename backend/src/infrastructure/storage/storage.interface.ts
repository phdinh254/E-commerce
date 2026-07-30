export interface UploadFileInput {
  path: string;
  buffer: Buffer;
  contentType: string;
}

export interface UploadFileResult {
  path: string;
  bucket: string;
}

export interface StorageProvider {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  remove(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
