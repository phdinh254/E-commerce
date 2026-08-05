import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { DatabaseConfig } from '../../config/configuration';
import {
  evaluateResetGuard,
  sanitizeDatabaseTarget,
} from './helpers/reset-guard';
import { buildStorageProviderIfConfigured } from './helpers/build-storage-provider';
import { ProductImageEntity } from '../../modules/products/images/entities/product-image.entity';
import { runSeed } from './seed';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const THEN_SEED = process.argv.includes('--then-seed');
const SEED_OBJECT_PATH_PREFIX = 'seed/';

function readDatabaseConfigFromEnv(): DatabaseConfig {
  return {
    host: process.env.DATABASE_HOST as string,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    name: process.env.DATABASE_NAME as string,
    user: process.env.DATABASE_USER as string,
    password: process.env.DATABASE_PASSWORD ?? '',
    ssl: process.env.DATABASE_SSL === 'true',
    poolMax: 5,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 10000,
  };
}

/**
 * Deletes only the Supabase objects this seeder itself created — every
 * one is namespaced under `seed/` (see product-images.seeder.ts) and
 * tracked by its own `product_images` row, so this is a targeted cleanup
 * by manifest, never a bucket-wide list-and-delete.
 */
async function cleanupSeedStorage(dataSource: DataSource): Promise<void> {
  const storageProvider = buildStorageProviderIfConfigured();
  if (!storageProvider) {
    console.warn(
      'Supabase not configured — skipping seed Storage cleanup (nothing to verify in this environment).',
    );
    return;
  }

  const repository = dataSource.getRepository(ProductImageEntity);
  const seedImages = await repository
    .createQueryBuilder('image')
    .where('image.object_path LIKE :prefix', {
      prefix: `${SEED_OBJECT_PATH_PREFIX}%`,
    })
    .withDeleted()
    .getMany();

  let failed = 0;
  for (const image of seedImages) {
    try {
      await storageProvider.remove(image.objectPath);
    } catch (error) {
      failed += 1;
      console.error(
        `Storage cleanup failed for seed-owned object path=${image.objectPath}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
  console.log(
    `Seed Storage cleanup: ${seedImages.length - failed}/${seedImages.length} object(s) removed` +
      (failed > 0
        ? ` — ${failed} FAILED (see errors above, not silently reported as complete)`
        : ''),
  );
}

async function run(): Promise<void> {
  const dbConfig = readDatabaseConfigFromEnv();
  const target = sanitizeDatabaseTarget(dbConfig);

  const guard = evaluateResetGuard({
    nodeEnv: process.env.NODE_ENV,
    allowDatabaseReset: process.env.ALLOW_DATABASE_RESET,
    argv: process.argv,
    databaseName: dbConfig.name,
    allowlist: process.env.DB_RESET_ALLOWLIST,
  });

  console.log(`Reset target (sanitized): ${target}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? 'unset'}`);

  if (!guard.allowed) {
    console.error('Refusing to reset database:');
    for (const reason of guard.reasons) {
      console.error(`  - ${reason}`);
    }
    process.exitCode = 1;
    return;
  }

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    // Storage cleanup happens BEFORE the schema drop — after the drop,
    // `product_images` rows (the manifest) are gone, so this ordering is
    // load-bearing, not incidental.
    await cleanupSeedStorage(dataSource);

    console.log('Dropping and recreating the public schema...');
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.query('DROP SCHEMA public CASCADE');
    await queryRunner.query('CREATE SCHEMA public');
    await queryRunner.release();

    console.log('Running migrations...');
    await dataSource.runMigrations();

    console.log('Reset complete.');
  } finally {
    await dataSource.destroy();
  }

  if (THEN_SEED) {
    console.log('--then-seed: running seed...');
    await runSeed();
  }
}

run().catch((error) => {
  console.error(
    'Reset failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
