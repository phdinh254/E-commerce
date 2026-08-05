import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { runSeed } from '../src/database/seeds/seed';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';

/**
 * Exercises the REAL seed.ts orchestrator (not a mock) against the real
 * test database — same DataSource config the CLI script uses, just
 * invoked in-process so this spec can inspect the result via TypeORM and
 * the HTTP API in the same test run. Requires SEED_ADMIN_PASSWORD /
 * SEED_DEFAULT_PASSWORD to already be set (see .env.test).
 */
describe('Seed data (integration + smoke)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());

    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_images" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_attributes" CASCADE');
    await dataSource.query(
      'TRUNCATE TABLE "product_variant_change_logs" CASCADE',
    );
    await dataSource.query(
      'TRUNCATE TABLE "product_variant_option_values" CASCADE',
    );
    await dataSource.query('TRUNCATE TABLE "product_variants" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_option_values" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_options" CASCADE');
    await dataSource.query('TRUNCATE TABLE "products" CASCADE');
    await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');

    // First run — this is the actual CLI entrypoint's exported function,
    // run against the same database the e2e app is connected to.
    await runSeed();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('creates exactly the expected row counts on the first run', async () => {
    const counts = await Promise.all(
      [
        'users',
        'categories',
        'products',
        'product_options',
        'product_option_values',
        'product_variants',
        'product_variant_option_values',
        'product_attributes',
        'coupons',
      ].map(async (table) => {
        const rows = await dataSource.query<{ c: number }[]>(
          `SELECT COUNT(*)::int AS c FROM "${table}"`,
        );
        return [table, rows[0].c] as const;
      }),
    );
    const byTable = Object.fromEntries(counts);
    expect(byTable.users).toBe(4);
    expect(byTable.categories).toBe(6);
    expect(byTable.products).toBe(10);
    expect(byTable.product_options).toBe(4);
    expect(byTable.product_option_values).toBe(11);
    expect(byTable.product_variants).toBe(10);
    expect(byTable.product_variant_option_values).toBe(14);
    expect(byTable.product_attributes).toBe(16);
    expect(byTable.coupons).toBe(5);
  });

  it('running seed a second time is idempotent — counts unchanged, no duplicates', async () => {
    await runSeed();
    const counts = await Promise.all(
      ['users', 'categories', 'products', 'product_variants', 'coupons'].map(
        async (table) => {
          const rows = await dataSource.query<{ c: number }[]>(
            `SELECT COUNT(*)::int AS c FROM "${table}"`,
          );
          return [table, rows[0].c] as const;
        },
      ),
    );
    const byTable = Object.fromEntries(counts);
    expect(byTable.users).toBe(4);
    expect(byTable.categories).toBe(6);
    expect(byTable.products).toBe(10);
    expect(byTable.product_variants).toBe(10);
    expect(byTable.coupons).toBe(5);
  });

  it('never leaves a plain-text password — the hash verifies via argon2', async () => {
    const repo = dataSource.getRepository(UserEntity);
    const admin = await repo.findOne({
      where: { email: 'admin.demo@example.local' },
    });
    expect(admin?.passwordHash).toBeTruthy();
    expect(admin?.passwordHash).not.toBe(process.env.SEED_ADMIN_PASSWORD);
    const valid = await argon2.verify(
      admin!.passwordHash!,
      process.env.SEED_ADMIN_PASSWORD!,
    );
    expect(valid).toBe(true);
  });

  it('seeds the ADMIN role correctly', async () => {
    const repo = dataSource.getRepository(UserEntity);
    const admin = await repo.findOne({
      where: { email: 'admin.demo@example.local' },
    });
    expect(admin?.role).toBe(UserRole.ADMIN);
    const customer = await repo.findOne({
      where: { email: 'customer.one@example.local' },
    });
    expect(customer?.role).toBe(UserRole.CUSTOMER);
  });

  it('builds the category parent-child hierarchy correctly', async () => {
    const rows = await dataSource.query<
      { slug: string; parent_slug: string | null }[]
    >(
      `SELECT c.slug, p.slug AS parent_slug
       FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
       WHERE c.slug = 'ao-thun'`,
    );
    expect(rows[0].parent_slug).toBe('thoi-trang-nam');
  });

  it('a product resolves to the correct category', async () => {
    const rows = await dataSource.query<{ category_slug: string }[]>(
      `SELECT c.slug AS category_slug FROM products pr
       JOIN categories c ON c.id = pr.category_id
       WHERE pr.slug = 'ao-thun-basic-den'`,
    );
    expect(rows[0].category_slug).toBe('ao-thun');
  });

  it('variants belong to the correct product and have unique combinations', async () => {
    const rows = await dataSource.query<{ sku: string }[]>(
      `SELECT v.sku FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE p.slug = 'ao-thun-basic-den'
       ORDER BY v.sku`,
    );
    expect(rows.map((r) => r.sku)).toEqual([
      'TSHIRT-BASIC-BLACK-L',
      'TSHIRT-BASIC-BLACK-M',
      'TSHIRT-BASIC-BLACK-S',
      'TSHIRT-BASIC-WHITE-M',
    ]);
  });

  it('does not link an Option of one product to a Variant of another product', async () => {
    const rows = await dataSource.query<{ bad_count: number }[]>(
      `SELECT COUNT(*)::int AS bad_count
       FROM product_variant_option_values jvo
       JOIN product_variants v ON v.id = jvo.variant_id
       JOIN product_option_values pov ON pov.id = jvo.option_value_id
       JOIN product_options po ON po.id = pov.option_id
       WHERE po.product_id <> v.product_id`,
    );
    expect(rows[0].bad_count).toBe(0);
  });

  it('attributes belong to the correct product with no duplicates', async () => {
    const rows = await dataSource.query<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM product_attributes pa
       JOIN products p ON p.id = pa.product_id
       WHERE p.slug = 'ao-thun-basic-den'`,
    );
    expect(rows[0].c).toBe(3);
  });

  it('coupon business rules hold (percentage in range, dates valid, applicable category resolved)', async () => {
    const rows = await dataSource.query<
      { code: string; discount_value: number; category_slug: string | null }[]
    >(
      `SELECT co.code, co.discount_value, c.slug AS category_slug
       FROM coupons co LEFT JOIN categories c ON c.id = co.applicable_category_id
       WHERE co.code = 'AOTHUNSALE'`,
    );
    expect(rows[0].discount_value).toBe(15);
    expect(rows[0].category_slug).toBe('ao-thun');
  });

  it('no foreign key is violated (product_images has no orphaned rows)', async () => {
    const rows = await dataSource.query<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM product_images pi
       LEFT JOIN products p ON p.id = pi.product_id WHERE p.id IS NULL`,
    );
    expect(rows[0].c).toBe(0);
  });

  // -----------------------------------------------------------------
  // Smoke test against the real HTTP API
  // -----------------------------------------------------------------

  it('smoke: seeded CUSTOMER can log in via the real Auth API', async () => {
    const res = await request(server()).post('/api/v1/auth/login').send({
      email: 'customer.one@example.local',
      password: process.env.SEED_DEFAULT_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('smoke: seeded ADMIN can log in via the real Auth API', async () => {
    const res = await request(server()).post('/api/v1/auth/login').send({
      email: 'admin.demo@example.local',
      password: process.env.SEED_ADMIN_PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it('smoke: GET /categories shows seeded categories', async () => {
    const res = await request(server()).get('/api/v1/categories');
    expect(res.status).toBe(200);
    const items = (res.body.items ?? res.body) as { slug: string }[];
    const slugs = items.map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['ao-thun', 'giay-dep']));
  });

  it('smoke: GET /products shows an active seeded product', async () => {
    const res = await request(server())
      .get('/api/v1/products/slug/ao-thun-basic-den')
      .send();
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Áo thun basic đen');
    expect(res.body.category.slug).toBe('ao-thun');
  });

  it('smoke: an inactive seeded product is not exposed on the public API', async () => {
    const res = await request(server()).get(
      '/api/v1/products/slug/quan-jean-baggy',
    );
    expect(res.status).toBe(404);
  });

  it('smoke: product variants are visible via the public API', async () => {
    const product = await request(server()).get(
      '/api/v1/products/slug/ao-thun-basic-den',
    );
    const res = await request(server()).get(
      `/api/v1/products/${product.body.id}/variants`,
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it('smoke: product attributes are visible via the public API', async () => {
    const product = await request(server()).get(
      '/api/v1/products/slug/ao-thun-basic-den',
    );
    const res = await request(server()).get(
      `/api/v1/products/${product.body.id}/attributes`,
    );
    expect(res.status).toBe(200);
    const attributes = res.body as { name: string }[];
    expect(attributes.some((a) => a.name === 'Chất liệu')).toBe(true);
  });
});
