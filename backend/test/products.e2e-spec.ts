import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Products (e2e)', () => {
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

  let adminEmailCounter = 0;
  let customerEmailCounter = 0;

  async function getAdminToken(): Promise<string> {
    adminEmailCounter += 1;
    const email = `admin${adminEmailCounter}@example.com`;
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

  async function getCustomerToken(): Promise<string> {
    customerEmailCounter += 1;
    const email = `customer${customerEmailCounter}@example.com`;
    await request(server()).post('/api/v1/auth/register').send({
      email,
      password: 'StrongPass123!',
      fullName: 'Customer User',
    });
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongPass123!' });
    return res.body.accessToken as string;
  }

  async function createCategory(
    token: string,
    name = 'Thời trang',
  ): Promise<string> {
    const res = await request(server())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });
    return res.body.id as string;
  }

  let skuCounter = 0;
  function nextSku(): string {
    skuCounter += 1;
    return `SKU-${skuCounter}-${Date.now()}`;
  }

  describe('POST /api/v1/products', () => {
    it('ADMIN can create a product', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Áo thun nam',
          sku: nextSku(),
          price: 199000,
          categoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Áo thun nam');
      expect(res.body.slug).toBe('ao-thun-nam');
      expect(res.body.price).toBe(199000);
      expect(res.body.isActive).toBe(true);
      expect(res.body.isFeatured).toBe(false);
      expect(res.body.category.id).toBe(categoryId);
    });

    it('trims the name and normalizes SKU to uppercase', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const sku = nextSku();

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '  Quần jean  ',
          sku: sku.toLowerCase(),
          price: 350000,
          categoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Quần jean');
      expect(res.body.sku).toBe(sku.toUpperCase());
    });

    it('rejects a negative price (400)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', sku: nextSku(), price: -1, categoryId });
      expect(res.status).toBe(400);
    });

    it('allows a price of exactly 0', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Quà tặng', sku: nextSku(), price: 0, categoryId });
      expect(res.status).toBe(201);
      expect(res.body.price).toBe(0);
    });

    it('rejects a non-existent categoryId (400)', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          sku: nextSku(),
          price: 1000,
          categoryId: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('rejects a soft-deleted categoryId (400)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token, 'Sẽ bị xóa');
      await request(server())
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', sku: nextSku(), price: 1000, categoryId });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate SKU (409)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const sku = nextSku();
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sản phẩm A', sku, price: 1000, categoryId });

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sản phẩm B',
          sku: sku.toLowerCase(),
          price: 2000,
          categoryId,
        });

      expect(res.status).toBe(409);
    });

    it('rejects a duplicate name-derived slug (409)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện thoại', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện Thoại', sku: nextSku(), price: 1000, categoryId });

      expect(res.status).toBe(409);
    });

    it('rejects an unknown/forbidden field via whitelist (400)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          sku: nextSku(),
          price: 1000,
          categoryId,
          id: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('CUSTOMER is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const categoryId = await createCategory(adminToken);
      const customerToken = await getCustomerToken();

      const res = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'X', sku: nextSku(), price: 1000, categoryId });
      expect(res.status).toBe(403);
    });

    it('Guest / unauthenticated is denied (401)', async () => {
      const res = await request(server())
        .post('/api/v1/products')
        .send({ name: 'X', sku: nextSku(), price: 1000 });
      expect(res.status).toBe(401);
    });

    it('a fake X-Role header has no effect (still 401 without a real token)', async () => {
      const res = await request(server())
        .post('/api/v1/products')
        .set('X-Role', 'ADMIN')
        .send({ name: 'X', sku: nextSku(), price: 1000 });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/products/:id and /slug/:slug', () => {
    it('returns the product detail by id', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Chi tiết SP', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server()).get(
        `/api/v1/products/${created.body.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.deletedAt).toBeUndefined();
    });

    it('returns the product detail by slug', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Giày thể thao',
          sku: nextSku(),
          price: 500000,
          categoryId,
        });

      const res = await request(server()).get(
        '/api/v1/products/slug/giay-the-thao',
      );
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Giày thể thao');
    });

    it('returns 404 for a well-formed but non-existent id', async () => {
      const res = await request(server()).get(
        '/api/v1/products/11111111-1111-1111-1111-111111111111',
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 (not 500) for a malformed id', async () => {
      const res = await request(server()).get('/api/v1/products/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 for an inactive product', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Ẩn',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isActive: false,
        });

      const res = await request(server()).get(
        `/api/v1/products/${created.body.id}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 after soft delete', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sẽ xóa', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server()).get(
        `/api/v1/products/${created.body.id}`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/products (search & list)', () => {
    it('lists active products and excludes inactive ones', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hoạt động', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Ẩn',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isActive: false,
        });

      const res = await request(server()).get('/api/v1/products');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Hoạt động');
    });

    it('supports pagination', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      for (let i = 0; i < 5; i += 1) {
        await request(server())
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: `Sản phẩm ${i}`,
            sku: nextSku(),
            price: 1000,
            categoryId,
          });
      }

      const res = await request(server())
        .get('/api/v1/products')
        .query({ page: 2, limit: 2 });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('caps page size at the maximum allowed (400 beyond max)', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ limit: 1000 });
      expect(res.status).toBe(400);
    });

    it('filters by minPrice and maxPrice (inclusive)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const prices = [50_000, 150_000, 250_000, 350_000];
      for (const price of prices) {
        await request(server())
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Giá ${price}`, sku: nextSku(), price, categoryId });
      }

      const res = await request(server())
        .get('/api/v1/products')
        .query({ categoryId, minPrice: 150_000, maxPrice: 250_000 });
      const returnedPrices = (res.body.items as { price: number }[])
        .map((item) => item.price)
        .sort((a, b) => a - b);
      expect(returnedPrices).toEqual([150_000, 250_000]);
    });

    it('rejects minPrice greater than maxPrice (400)', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ minPrice: 500_000, maxPrice: 100_000 });
      expect(res.status).toBe(400);
    });

    it('rejects a negative minPrice (400)', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ minPrice: -1 });
      expect(res.status).toBe(400);
    });

    it('rejects a non-integer maxPrice (400)', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ maxPrice: 'not-a-number' });
      expect(res.status).toBe(400);
    });

    it('searches by name (case-insensitive, Vietnamese diacritics preserved)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Điện thoại Samsung',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Laptop Dell', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: 'ĐIỆN' });
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Điện thoại Samsung');
    });

    it('searches by exact SKU', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const sku = nextSku();
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Có SKU riêng', sku, price: 1000, categoryId });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: sku });
      expect(res.body.items).toHaveLength(1);
    });

    it('ranks an exact name match above a mere substring match', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Áo', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Áo khoác', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: 'Áo' });
      expect(res.body.items[0].name).toBe('Áo');
    });

    it('filters by categoryId', async () => {
      const token = await getAdminToken();
      const categoryA = await createCategory(token, 'Danh mục A');
      const categoryB = await createCategory(token, 'Danh mục B');
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Trong A',
          sku: nextSku(),
          price: 1000,
          categoryId: categoryA,
        });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Trong B',
          sku: nextSku(),
          price: 1000,
          categoryId: categoryB,
        });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ categoryId: categoryA });
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Trong A');
    });

    it('rejects an unknown sortBy field (400, allowlist enforced)', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ sortBy: 'id; DROP TABLE products;' });
      expect(res.status).toBe(400);
    });

    it('sorts by price ascending when requested', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Đắt', sku: nextSku(), price: 999000, categoryId });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rẻ', sku: nextSku(), price: 10000, categoryId });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ sortBy: 'price', sortOrder: 'ASC' });
      expect(res.body.items[0].name).toBe('Rẻ');
      expect(res.body.items[1].name).toBe('Đắt');
    });

    it('treats % and _ in the search keyword as literal characters, not wildcards', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Giảm 50% hôm nay',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Không liên quan',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: '50%' });
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Giảm 50% hôm nay');
    });

    it('a SQL-injection-shaped search keyword returns no error and no data leak', async () => {
      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: "'; DROP TABLE products; --" });
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });

  describe('GET /api/v1/products/suggestions', () => {
    it('returns matching, deduplicated prefix suggestions', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Áo thun nam', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Áo thun nữ', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Quần jean', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .get('/api/v1/products/suggestions')
        .query({ q: 'Áo' });
      expect(res.status).toBe(200);
      const suggestions = res.body.data as string[];
      expect([...suggestions].sort()).toEqual(['Áo thun nam', 'Áo thun nữ']);
    });

    it('rejects a query shorter than the minimum length (400)', async () => {
      const res = await request(server())
        .get('/api/v1/products/suggestions')
        .query({ q: 'a' });
      expect(res.status).toBe(400);
    });

    it('does not suggest inactive products', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Ẩn gợi ý',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isActive: false,
        });

      const res = await request(server())
        .get('/api/v1/products/suggestions')
        .query({ q: 'Ẩn' });
      expect(res.body.data).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      for (let i = 0; i < 5; i += 1) {
        await request(server())
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: `Giày ${i}`,
            sku: nextSku(),
            price: 1000,
            categoryId,
          });
      }

      const res = await request(server())
        .get('/api/v1/products/suggestions')
        .query({ q: 'Giày', limit: 2 });
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/products/featured', () => {
    it('returns only featured, active products ordered by featuredOrder', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nổi bật 2',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
          featuredOrder: 2,
        });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nổi bật 1',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
          featuredOrder: 1,
        });
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Không nổi bật',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });

      const res = await request(server()).get('/api/v1/products/featured');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Nổi bật 1');
      expect(res.body[1].name).toBe('Nổi bật 2');
    });

    it('returns an empty array when there are no featured products', async () => {
      const res = await request(server()).get('/api/v1/products/featured');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      for (let i = 0; i < 3; i += 1) {
        await request(server())
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: `Nổi bật ${i}`,
            sku: nextSku(),
            price: 1000,
            categoryId,
            isFeatured: true,
          });
      }

      const res = await request(server())
        .get('/api/v1/products/featured')
        .query({ limit: 2 });
      expect(res.body).toHaveLength(2);
    });

    it('does not include inactive or soft-deleted featured products', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const inactive = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nổi bật nhưng ẩn',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
          isActive: false,
        });
      const deleted = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nổi bật nhưng đã xóa',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
        });
      await request(server())
        .delete(`/api/v1/products/${deleted.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server()).get('/api/v1/products/featured');
      const featured = res.body as Array<{ id: string }>;
      const ids = featured.map((p) => p.id);
      expect(ids).not.toContain(inactive.body.id);
      expect(ids).not.toContain(deleted.body.id);
    });

    it('response projection excludes long description and audit fields', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Chiếu',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
          description: 'mô tả dài không cần cho landing',
        });

      const res = await request(server()).get('/api/v1/products/featured');
      expect(res.body[0].description).toBeUndefined();
      expect(res.body[0].deletedAt).toBeUndefined();
      expect(res.body[0].createdAt).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/products/:id', () => {
    it('ADMIN can partially update a product', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Trước', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 5000 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Trước');
      expect(res.body.price).toBe(5000);
    });

    it('renaming does not change the slug unless slug is sent explicitly', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tên gốc', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tên đã đổi' });

      expect(res.body.slug).toBe(created.body.slug);
    });

    it('can change the category', async () => {
      const token = await getAdminToken();
      const categoryA = await createCategory(token, 'Danh mục A2');
      const categoryB = await createCategory(token, 'Danh mục B2');
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Đổi danh mục',
          sku: nextSku(),
          price: 1000,
          categoryId: categoryA,
        });

      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId: categoryB });

      expect(res.status).toBe(200);
      expect(res.body.category.id).toBe(categoryB);
    });

    it('toggles isFeatured', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Toggle', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isFeatured: true });
      expect(res.body.isFeatured).toBe(true);
    });

    it('rejects a duplicate SKU on update (409)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const skuA = nextSku();
      await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A', sku: skuA, price: 1000, categoryId });
      const b = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'B', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .patch(`/api/v1/products/${b.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: skuA });
      expect(res.status).toBe(409);
    });

    it('rejects a forbidden field via whitelist (400)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bảo vệ', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ createdAt: '2020-01-01T00:00:00.000Z' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when updating a non-existent product', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .patch('/api/v1/products/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 1000 });
      expect(res.status).toBe(404);
    });

    it('CUSTOMER is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const categoryId = await createCategory(adminToken);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', sku: nextSku(), price: 1000, categoryId });

      const customerToken = await getCustomerToken();
      const res = await request(server())
        .patch(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ price: 1 });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('ADMIN can soft-delete a product', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sẽ bị xóa', sku: nextSku(), price: 1000, categoryId });

      const res = await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('the row still exists in the database with deleted_at set', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Kiểm tra deleted_at',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });
      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const rows = await dataSource.query(
        'SELECT deleted_at FROM "products" WHERE id = $1',
        [created.body.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted_at).not.toBeNull();
    });

    it('deleted product disappears from list/search', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Biến mất', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server())
        .get('/api/v1/products')
        .query({ search: 'Biến mất' });
      expect(res.body.items).toHaveLength(0);
    });

    it('deleted featured product disappears from featured', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nổi bật sẽ xóa',
          sku: nextSku(),
          price: 1000,
          categoryId,
          isFeatured: true,
        });
      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server()).get('/api/v1/products/featured');
      const featured = res.body as Array<{ id: string }>;
      expect(featured.find((p) => p.id === created.body.id)).toBeUndefined();
    });

    it('repeated deletion returns 404', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Xóa lặp lại', sku: nextSku(), price: 1000, categoryId });
      await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('CUSTOMER is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const categoryId = await createCategory(adminToken);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bảo vệ xóa', sku: nextSku(), price: 1000, categoryId });

      const customerToken = await getCustomerToken();
      const res = await request(server())
        .delete(`/api/v1/products/${created.body.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('Guest is denied (401)', async () => {
      const token = await getAdminToken();
      const categoryId = await createCategory(token);
      const created = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bảo vệ guest',
          sku: nextSku(),
          price: 1000,
          categoryId,
        });

      const res = await request(server()).delete(
        `/api/v1/products/${created.body.id}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
