import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { FakeStorageProvider } from './utils/fake-storage.provider';
import { seedProductImages } from '../src/database/seeds/seeders/product-images.seeder';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ProductImageEntity } from '../src/modules/products/images/entities/product-image.entity';
import { ProductImageSeedRecordDto } from '../src/database/seeds/dto/product-image-seed-record.dto';

/**
 * There is no real Supabase test project/credential available in this
 * environment (same constraint as the Chapter 11 report) — this exercises
 * `seedProductImages` end-to-end against a real Postgres test database
 * using `FakeStorageProvider` (a stateful in-memory adapter satisfying
 * the exact same `StorageProvider` contract Supabase's real adapter
 * does), per the "Dùng fake adapter cho automated test" policy in
 * docs/seed-strategy.md / Ch12-B111-13.
 */
describe('seedProductImages (integration, fake storage adapter)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminUserId: string;
  let productId: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());

    await dataSource.query('TRUNCATE TABLE "product_images" CASCADE');
    await dataSource.query('TRUNCATE TABLE "products" CASCADE');
    await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');

    const userRepo = dataSource.getRepository(UserEntity);
    const admin = await userRepo.save(
      userRepo.create({
        email: 'seed-images-admin@example.local',
        fullName: 'Seed Images Admin',
        role: UserRole.ADMIN,
        passwordHash: 'not-a-real-hash',
      }),
    );
    adminUserId = admin.id;

    const category = await dataSource.query<{ id: string }[]>(
      `INSERT INTO categories (name, slug) VALUES ('Test', 'test-cat-images') RETURNING id`,
    );
    const product = await dataSource.query<{ id: string }[]>(
      `INSERT INTO products (category_id, name, slug, sku, price)
       VALUES ($1, 'Test Product', 'test-product-images', 'TEST-IMG-001', 100000)
       RETURNING id`,
      [category[0].id],
    );
    productId = product[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "product_images" CASCADE');
  });

  function record(overrides: Partial<ProductImageSeedRecordDto> = {}) {
    return {
      productSlug: 'test-product-images',
      assetFile: 'placeholder-1.jpg',
      ...overrides,
    };
  }

  it('uploads and inserts an image with a deterministic, seed-namespaced object path', async () => {
    const fakeStorage = new FakeStorageProvider();
    const productSlugToId = new Map([['test-product-images', productId]]);

    const result = await dataSource.transaction((manager) =>
      seedProductImages(
        manager,
        [record({ altText: 'Ảnh test' })],
        productSlugToId,
        new Map(),
        new Map(),
        fakeStorage,
        adminUserId,
      ),
    );

    expect(result.storageSkipped).toBe(false);
    expect(result.created).toBe(1);

    const repo = dataSource.getRepository(ProductImageEntity);
    const [image] = await repo.find({ where: { productId } });
    expect(image.objectPath).toBe(
      'seed/products/test-product-images/product-0.jpg',
    );
    expect(image.variantId).toBeNull();
    expect(image.createdBy).toBe(adminUserId);
    expect(fakeStorage.has(image.objectPath)).toBe(true);
  });

  it('is idempotent — a second run with the same record does not re-upload or duplicate the row', async () => {
    const fakeStorage = new FakeStorageProvider();
    const productSlugToId = new Map([['test-product-images', productId]]);
    const records = [record({ altText: 'Ảnh test idempotent' })];

    await dataSource.transaction((manager) =>
      seedProductImages(
        manager,
        records,
        productSlugToId,
        new Map(),
        new Map(),
        fakeStorage,
        adminUserId,
      ),
    );
    const second = await dataSource.transaction((manager) =>
      seedProductImages(
        manager,
        records,
        productSlugToId,
        new Map(),
        new Map(),
        fakeStorage,
        adminUserId,
      ),
    );

    expect(second.created).toBe(0);
    expect(second.alreadyExisted).toBe(1);
    expect(fakeStorage.size()).toBe(1);
  });

  it('returns storageSkipped=true (and does nothing) when storageProvider is null', async () => {
    const productSlugToId = new Map([['test-product-images', productId]]);
    const result = await dataSource.transaction((manager) =>
      seedProductImages(
        manager,
        [record()],
        productSlugToId,
        new Map(),
        new Map(),
        null,
        adminUserId,
      ),
    );
    expect(result.storageSkipped).toBe(true);
    expect(result.created).toBe(0);
  });
});
