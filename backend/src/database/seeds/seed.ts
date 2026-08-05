import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { readFromFile } from './helpers/read-from-file';
import { validateSeedGraph, SeedGraph } from './helpers/cross-file-validation';
import { buildStorageProviderIfConfigured } from './helpers/build-storage-provider';
import { UserSeedRecordDto } from './dto/user-seed-record.dto';
import { CategorySeedRecordDto } from './dto/category-seed-record.dto';
import { ProductSeedRecordDto } from './dto/product-seed-record.dto';
import { ProductOptionSeedRecordDto } from './dto/product-option-seed-record.dto';
import { ProductVariantSeedRecordDto } from './dto/product-variant-seed-record.dto';
import { ProductImageSeedRecordDto } from './dto/product-image-seed-record.dto';
import { ProductAttributeSeedRecordDto } from './dto/product-attribute-seed-record.dto';
import { CouponSeedRecordDto } from './dto/coupon-seed-record.dto';
import { seedUsers } from './seeders/users.seeder';
import { seedCategories } from './seeders/categories.seeder';
import { seedProducts } from './seeders/products.seeder';
import { seedProductOptions } from './seeders/product-options.seeder';
import { seedProductVariants } from './seeders/product-variants.seeder';
import { seedProductImages } from './seeders/product-images.seeder';
import { seedProductAttributes } from './seeders/product-attributes.seeder';
import { seedCoupons } from './seeders/coupons.seeder';
import { UserEntity } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const VALIDATE_ONLY = process.argv.includes('--validate-only');

async function loadSeedGraph(): Promise<SeedGraph> {
  // Step 2: read every file. Step 3: per-file runtime validation happens
  // inside readFromFile itself (schema-checked before this function
  // returns). Any of these can throw SeedFileNotFoundError /
  // SeedFileMalformedError / SeedPathTraversalError / SeedValidationError.
  const [
    users,
    categories,
    products,
    options,
    variants,
    images,
    attributes,
    coupons,
  ] = await Promise.all([
    readFromFile('users.json', UserSeedRecordDto),
    readFromFile('categories.json', CategorySeedRecordDto),
    readFromFile('products.json', ProductSeedRecordDto),
    readFromFile('product-options.json', ProductOptionSeedRecordDto),
    readFromFile('product-variants.json', ProductVariantSeedRecordDto),
    readFromFile('product-images.json', ProductImageSeedRecordDto),
    readFromFile('product-attributes.json', ProductAttributeSeedRecordDto),
    readFromFile('coupons.json', CouponSeedRecordDto),
  ]);

  const graph: SeedGraph = {
    users,
    categories,
    products,
    options,
    variants,
    images,
    attributes,
    coupons,
  };

  // Step 4: cross-file validation — referential integrity + business
  // rules BEFORE any database connection is opened.
  validateSeedGraph(graph);

  return graph;
}

function requirePassword(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `${envVar} must be set to run the seed (development/test only demo credential — never production)`,
    );
  }
  return value;
}

export async function runSeed(): Promise<void> {
  const startedAt = Date.now();

  // Step 1: environment guard.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed: NODE_ENV=production');
  }

  const graph = await loadSeedGraph();
  console.log(
    `Seed data validated: ${graph.users.length} users, ${graph.categories.length} categories, ` +
      `${graph.products.length} products, ${graph.options.length} option groups, ` +
      `${graph.variants.length} variants, ${graph.images.length} images, ` +
      `${graph.attributes.length} attributes, ${graph.coupons.length} coupons.`,
  );

  if (VALIDATE_ONLY) {
    console.log('--validate-only: skipping database connection.');
    return;
  }

  // Never log these values themselves — only that they were read.
  const adminPassword = requirePassword('SEED_ADMIN_PASSWORD');
  const defaultPassword = requirePassword('SEED_DEFAULT_PASSWORD');

  // Step 5: connect.
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    // Steps 6-10 + 12-13: pure-DB seeding, all-or-nothing in one
    // transaction (users through variants, then attributes/coupons in a
    // second transaction — see the boundary note below).
    const coreResult = await dataSource.transaction(async (manager) => {
      const users = await seedUsers(manager, graph.users, {
        admin: adminPassword,
        default: defaultPassword,
      });
      const categories = await seedCategories(manager, graph.categories);
      const products = await seedProducts(
        manager,
        graph.products,
        categories.slugToId,
      );
      const options = await seedProductOptions(
        manager,
        graph.options,
        products.slugToId,
      );
      const variants = await seedProductVariants(
        manager,
        graph.variants,
        products.slugToId,
        options.valueKeyToId,
      );
      return { users, categories, products, options, variants };
    });

    // Step 11: product images. Deliberately OUTSIDE the DB transaction
    // above — uploading to Supabase Storage is a network call, and this
    // codebase's own rule (Chapter 11) is "never hold a DB transaction
    // open across a network call". Each image is its own upload +
    // single-row insert with local compensation (see
    // product-images.seeder.ts) — NOT part of one all-or-nothing
    // transaction with users/categories/products/variants. This is a
    // deliberately relaxed boundary: if images fail partway, the
    // already-committed users/categories/products/variants from the
    // transaction above are NOT rolled back. Documented risk: a seed run
    // that fails during images leaves a valid (not corrupt, not
    // orphaned) partial product catalog with some/no images — safe to
    // simply re-run seed.ts, since every step here is idempotent by
    // natural key.
    const adminRepo = dataSource.getRepository(UserEntity);
    const adminUser = await adminRepo.findOne({
      where: { role: UserRole.ADMIN },
      order: { createdAt: 'ASC' },
    });
    if (!adminUser) {
      throw new Error(
        'No ADMIN user found after seeding users — cannot attribute createdBy on ProductImage',
      );
    }

    const storageProvider = buildStorageProviderIfConfigured();
    if (!storageProvider) {
      console.warn(
        'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_STORAGE_BUCKET are not configured — skipping product image seeding (Ch12-B111/B113 storage step CHƯA KIỂM CHỨNG in this environment).',
      );
    }
    const images = await dataSource.transaction(async (manager) =>
      seedProductImages(
        manager,
        graph.images,
        coreResult.products.slugToId,
        coreResult.variants.skuToId,
        coreResult.variants.skuToProductSlug,
        storageProvider,
        adminUser.id,
      ),
    );

    // Steps 12-13: attributes + coupons — pure DB, no network, own
    // all-or-nothing transaction (independent of the images step above).
    const tailResult = await dataSource.transaction(async (manager) => {
      const attributes = await seedProductAttributes(
        manager,
        graph.attributes,
        coreResult.products.slugToId,
      );
      const coupons = await seedCoupons(
        manager,
        graph.coupons,
        coreResult.categories.slugToId,
        coreResult.products.slugToId,
      );
      return { attributes, coupons };
    });

    // Step 14: post-condition sanity checks (cheap, targeted — not a
    // full re-validation).
    const orphanedImages = await dataSource.query<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM product_images pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE p.id IS NULL`,
    );
    if (Number(orphanedImages[0].count) > 0) {
      throw new Error(
        'Post-condition failed: orphaned product_images row(s) detected',
      );
    }

    // Step 15: summary — counts and timing only, never secrets.
    const elapsedMs = Date.now() - startedAt;
    console.log('--- Seed summary ---');
    console.log(
      `Users:      created=${coreResult.users.created} updated=${coreResult.users.updated}`,
    );
    console.log(
      `Categories: created=${coreResult.categories.created} updated=${coreResult.categories.updated}`,
    );
    console.log(
      `Products:   created=${coreResult.products.created} updated=${coreResult.products.updated}`,
    );
    console.log(
      `Options:    created=${coreResult.options.created} updated=${coreResult.options.updated}`,
    );
    console.log(
      `Variants:   created=${coreResult.variants.created} updated=${coreResult.variants.updated}`,
    );
    console.log(
      images.storageSkipped
        ? 'Images:     SKIPPED (Supabase not configured)'
        : `Images:     created=${images.created} alreadyExisted=${images.alreadyExisted}`,
    );
    console.log(
      `Attributes: created=${tailResult.attributes.created} updated=${tailResult.attributes.updated}`,
    );
    console.log(
      `Coupons:    created=${tailResult.coupons.created} updated=${tailResult.coupons.updated}`,
    );
    console.log(`Elapsed:    ${elapsedMs}ms`);
    console.log('Status:     OK');
  } finally {
    // Step 16.
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runSeed().catch((error) => {
    console.error(
      'Seed failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
