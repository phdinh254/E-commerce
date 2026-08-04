import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import {
  PRODUCT_FEATURED_GENERATION_KEY,
  PRODUCT_SEARCH_GENERATION_KEY,
} from '../src/modules/products/cache/products-cache.constants';

/**
 * Exercises the Redis cache-aside integration against the real Redis test
 * container (not a mock) — RedisService/ioredis are only mocked in
 * ProductsCacheService's unit tests; this file proves the wiring actually
 * works end-to-end: keys are written, TTLs are set, and generation bumps
 * make stale entries unreachable after a mutation.
 */
describe('Products search/featured cache (e2e, real Redis)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisService: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "products" CASCADE');
    await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    await redisService.getClient().flushdb();
  });

  const server = () => app.getHttpServer();

  async function getAdminToken(): Promise<string> {
    const email = `admin-${Date.now()}-${Math.random()}@example.com`;
    await request(server()).post('/api/v1/auth/register').send({
      email,
      password: 'StrongPass123!',
      fullName: 'Admin User',
    });
    await dataSource
      .getRepository(UserEntity)
      .update({ email }, { role: UserRole.ADMIN });
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongPass123!' });
    return res.body.accessToken as string;
  }

  async function createCategory(token: string): Promise<string> {
    const res = await request(server())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Danh mục ${Date.now()}-${Math.random()}` });
    return res.body.id as string;
  }

  async function scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redisService
        .getClient()
        .scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  describe('search cache', () => {
    it('populates a Redis key with the configured TTL after the first search', async () => {
      await request(server())
        .get('/api/v1/products')
        .query({ page: 1, limit: 20 });

      const keys = await scanKeys('product:search:*:*');
      expect(keys.length).toBeGreaterThan(0);

      const ttl = await redisService.getClient().ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5); // PRODUCT_SEARCH_CACHE_TTL_SECONDS in .env.test
    });

    it('a different page creates a different cache key', async () => {
      await request(server())
        .get('/api/v1/products')
        .query({ page: 1, limit: 20 });
      await request(server())
        .get('/api/v1/products')
        .query({ page: 2, limit: 20 });

      const keys = await scanKeys('product:search:*:*');
      expect(keys.length).toBe(2);
    });

    it('an equivalent repeated query reuses the same cache key (no new key created)', async () => {
      await request(server())
        .get('/api/v1/products')
        .query({ page: 1, limit: 20 });
      await request(server())
        .get('/api/v1/products')
        .query({ page: 1, limit: 20 });

      const keys = await scanKeys('product:search:*:*');
      expect(keys.length).toBe(1);
    });

    it('a newly created product appears in search results on the very next request (invalidation, not a 60s wait)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);

      // Warm the cache with zero results.
      const before = await request(server())
        .get('/api/v1/products')
        .query({ search: 'sanphammoi' });
      expect(before.body.items).toHaveLength(0);

      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'SanPhamMoi',
          sku: `SKU-CACHE-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      const after = await request(server())
        .get('/api/v1/products')
        .query({ search: 'sanphammoi' });
      expect(after.body.items).toHaveLength(1);
    });

    it('creating a product increments the search generation counter', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const before = await redisService.get(PRODUCT_SEARCH_GENERATION_KEY);

      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bump generation',
          sku: `SKU-GEN-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      const after = await redisService.get(PRODUCT_SEARCH_GENERATION_KEY);
      expect(Number(after ?? 0)).toBeGreaterThan(Number(before ?? 0));
    });

    it('updating a product price is reflected immediately in search results', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Giá sẽ đổi',
          sku: `SKU-PRICE-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      await request(server())
        .get('/api/v1/products')
        .query({ search: 'Giá sẽ đổi' });

      await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 99999 });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: 'Giá sẽ đổi' });
      expect(res.body.items[0].price).toBe(99999);
    });

    it('a soft-deleted product disappears from cached search results immediately', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sẽ xóa khỏi cache',
          sku: `SKU-DEL-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      await request(server())
        .get('/api/v1/products')
        .query({ search: 'Sẽ xóa khỏi cache' });

      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: 'Sẽ xóa khỏi cache' });
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('featured cache', () => {
    it('populates a Redis key with a TTL longer than the search TTL', async () => {
      await request(server()).get('/api/v1/products/featured');

      const keys = await scanKeys('product:featured:*:*');
      expect(keys.length).toBeGreaterThan(0);

      const ttl = await redisService.getClient().ttl(keys[0]);
      expect(ttl).toBeGreaterThan(5); // > PRODUCT_SEARCH_CACHE_TTL_SECONDS
      expect(ttl).toBeLessThanOrEqual(30); // PRODUCT_FEATURED_CACHE_TTL_SECONDS in .env.test
    });

    it('a different limit creates a different cache key', async () => {
      await request(server())
        .get('/api/v1/products/featured')
        .query({ limit: 4 });
      await request(server())
        .get('/api/v1/products/featured')
        .query({ limit: 8 });

      const keys = await scanKeys('product:featured:*:*');
      expect(keys.length).toBe(2);
    });

    it('turning isFeatured on makes the product appear on the very next request', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sắp nổi bật',
          sku: `SKU-FEAT-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      await request(server()).get('/api/v1/products/featured');

      await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isFeatured: true });

      const res = await request(server()).get('/api/v1/products/featured');
      const featured = res.body as Array<{ id: string }>;
      expect(featured.some((p) => p.id === created.body.id)).toBe(true);
    });

    it('turning isFeatured off increments the featured generation counter', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sắp bỏ nổi bật',
          sku: `SKU-UNFEAT-${Date.now()}`,
          price: 1000,
          categoryId,
          isFeatured: true,
        });
      const before = await redisService.get(PRODUCT_FEATURED_GENERATION_KEY);

      await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isFeatured: false });

      const after = await redisService.get(PRODUCT_FEATURED_GENERATION_KEY);
      expect(Number(after ?? 0)).toBeGreaterThan(Number(before ?? 0));
    });

    it('creating a non-featured product does not bump the featured generation counter', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const before = await redisService.get(PRODUCT_FEATURED_GENERATION_KEY);

      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Không nổi bật, không ảnh hưởng cache featured',
          sku: `SKU-NOFEAT-${Date.now()}`,
          price: 1000,
          categoryId,
        });

      const after = await redisService.get(PRODUCT_FEATURED_GENERATION_KEY);
      expect(after).toBe(before);
    });
  });
});
