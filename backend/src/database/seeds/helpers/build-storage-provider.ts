import { ConfigService } from '@nestjs/config';
import configuration, { SupabaseConfig } from '../../../config/configuration';
import { SupabaseStorageProvider } from '../../../infrastructure/storage/supabase-storage.provider';
import type { StorageProvider } from '../../../infrastructure/storage/storage.interface';

/**
 * The seed runner has no NestJS DI container (no HTTP server is started —
 * see docs/seed-strategy.md), so `SupabaseStorageProvider` is constructed
 * by hand with a minimal object satisfying the one method it calls
 * (`ConfigService.get('supabase')`), fed from the same `configuration()`
 * factory the real app uses — never a second, separately-maintained
 * source of Supabase config.
 *
 * Returns `null` when Supabase is not configured — callers must treat
 * that as "skip the Storage step", never fabricate a fallback.
 */
export function buildStorageProviderIfConfigured(): StorageProvider | null {
  const config = configuration() as { supabase: SupabaseConfig };
  const supabase = config.supabase;
  if (!supabase.url || !supabase.serviceRoleKey || !supabase.storageBucket) {
    return null;
  }

  const configServiceLike = {
    get: (key: string) => (config as Record<string, unknown>)[key],
  } as unknown as ConfigService;

  return new SupabaseStorageProvider(configServiceLike);
}
