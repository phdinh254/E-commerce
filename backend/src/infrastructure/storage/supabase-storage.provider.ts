import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../config/configuration';
import {
  StorageConflictError,
  StorageProvider,
  StorageUnavailableError,
  UploadFileInput,
  UploadFileResult,
} from './storage.interface';

const DEFAULT_CACHE_CONTROL = '3600';

/** Matches Supabase Storage's "Duplicate"/"already exists" response for `upsert: false`. */
function isDuplicateObjectError(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already exists') || normalized.includes('duplicate')
  );
}

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private readonly client: SupabaseClient | null;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseConfig = this.configService.get<SupabaseConfig>('supabase');
    this.bucket = supabaseConfig?.storageBucket ?? '';

    if (supabaseConfig?.url && supabaseConfig?.serviceRoleKey) {
      this.client = createClient(
        supabaseConfig.url,
        supabaseConfig.serviceRoleKey,
        { auth: { persistSession: false } },
      );
    } else {
      this.client = null;
      this.logger.warn(
        'Supabase Storage is not configured. Upload endpoints will fail until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
      );
    }
  }

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    if (!this.client) {
      throw new StorageUnavailableError(
        'Supabase Storage client is not configured',
      );
    }
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.path, input.buffer, {
        contentType: input.contentType,
        upsert: false,
        cacheControl: input.cacheControl ?? DEFAULT_CACHE_CONTROL,
      });
    if (error) {
      // Sanitized: object path is not secret, but never log the buffer or
      // any header/credential here.
      this.logger.error(
        `Supabase upload failed for path=${input.path}: ${error.message}`,
      );
      if (isDuplicateObjectError(error.message)) {
        throw new StorageConflictError(
          `Object already exists at path: ${input.path}`,
        );
      }
      throw new StorageUnavailableError(
        `Supabase upload failed: ${error.message}`,
      );
    }
    return { path: input.path, bucket: this.bucket };
  }

  async remove(path: string): Promise<void> {
    if (!this.client) {
      throw new StorageUnavailableError(
        'Supabase Storage client is not configured',
      );
    }
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);
    if (error) {
      this.logger.error(
        `Supabase remove failed for path=${path}: ${error.message}`,
      );
      throw new StorageUnavailableError(
        `Supabase remove failed: ${error.message}`,
      );
    }
  }

  getBucketName(): string {
    return this.bucket;
  }

  async getSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    if (!this.client) {
      throw new StorageUnavailableError(
        'Supabase Storage client is not configured',
      );
    }
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      this.logger.error(
        `Supabase signed URL generation failed for path=${path}: ${error?.message}`,
      );
      throw new StorageUnavailableError(
        `Supabase signed URL generation failed: ${error?.message}`,
      );
    }
    return data.signedUrl;
  }
}
