import {
  StorageConflictError,
  StorageProvider,
  UploadFileInput,
  UploadFileResult,
} from '../../src/infrastructure/storage/storage.interface';

/**
 * In-memory `StorageProvider` used only in e2e tests — there is no real
 * Supabase test project/credential available in this environment (see the
 * final Chapter 11 report, section N). This still exercises the full
 * upload → DB-insert → compensation flow through `ProductImagesService`
 * with a real behavioral contract (`upsert: false` rejects a duplicate
 * path, `remove` is idempotent), just without a network call.
 */
export class FakeStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, Buffer>();
  failNextUpload = false;
  failNextRemove = false;

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    if (this.failNextUpload) {
      this.failNextUpload = false;
      throw new Error('simulated upload failure');
    }
    if (this.objects.has(input.path)) {
      throw new StorageConflictError(`Object already exists at ${input.path}`);
    }
    this.objects.set(input.path, input.buffer);
    return { path: input.path, bucket: this.getBucketName() };
  }

  async remove(path: string): Promise<void> {
    if (this.failNextRemove) {
      this.failNextRemove = false;
      throw new Error('simulated remove failure');
    }
    this.objects.delete(path);
  }

  async getSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    return `https://fake-storage.test/${path}?ttl=${expiresInSeconds}`;
  }

  getBucketName(): string {
    return 'product-images-test';
  }

  has(path: string): boolean {
    return this.objects.has(path);
  }

  size(): number {
    return this.objects.size;
  }
}
