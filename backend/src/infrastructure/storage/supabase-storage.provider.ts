import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../config/configuration';
import {
  StorageProvider,
  UploadFileInput,
  UploadFileResult,
} from './storage.interface';

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
      throw new Error('Supabase Storage client is not configured');
    }
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.path, input.buffer, {
        contentType: input.contentType,
        upsert: false,
      });
    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
    return { path: input.path, bucket: this.bucket };
  }

  async remove(path: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase Storage client is not configured');
    }
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);
    if (error) {
      throw new Error(`Supabase remove failed: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase Storage client is not configured');
    }
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      throw new Error(
        `Supabase signed URL generation failed: ${error?.message}`,
      );
    }
    return data.signedUrl;
  }
}
