import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Categories (e2e)', () => {
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

  describe('POST /api/v1/categories', () => {
    it('ADMIN can create a category', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện thoại' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Điện thoại');
      expect(res.body.slug).toBe('dien-thoai');
      expect(res.body.isActive).toBe(true);
      expect(res.body.displayOrder).toBe(0);
      expect(res.body.id).toBeDefined();
    });

    it('trims the name before saving', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  Laptop  ' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Laptop');
    });

    it('rejects an empty name (400)', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects a name exceeding the max length (400)', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a'.repeat(256) });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown/forbidden field via whitelist (400)', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Something',
          id: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate name-derived slug with 409', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện tử' });

      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện Tử' });

      expect(res.status).toBe(409);
    });

    it('rejects a parentId that does not exist (400)', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Con',
          parentId: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('CUSTOMER is denied (403)', async () => {
      const token = await getCustomerToken();
      const res = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });

    it('Guest is denied (401)', async () => {
      const res = await request(server())
        .post('/api/v1/categories')
        .send({ name: 'X' });
      expect(res.status).toBe(401);
    });

    it('an unauthenticated request is denied (401)', async () => {
      const res = await request(server())
        .post('/api/v1/categories')
        .send({ name: 'X' });
      expect(res.status).toBe(401);
    });

    it('a fake X-Role header has no effect (still 401 without a real token)', async () => {
      const res = await request(server())
        .post('/api/v1/categories')
        .set('X-Role', 'ADMIN')
        .send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/categories', () => {
    it('returns an empty list with correct pagination meta when there is no data', async () => {
      const res = await request(server()).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('is publicly accessible without any authentication', async () => {
      const res = await request(server()).get('/api/v1/categories');
      expect(res.status).toBe(200);
    });

    it('does not set a guest session cookie for a public list request', async () => {
      const res = await request(server()).get('/api/v1/categories');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('lists active categories and excludes inactive ones', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hoạt động' });
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ẩn', isActive: false });

      const res = await request(server()).get('/api/v1/categories');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Hoạt động');
    });

    it('supports pagination', async () => {
      const token = await getAdminToken();
      for (let i = 0; i < 5; i += 1) {
        await request(server())
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Danh mục ${i}` });
      }

      const res = await request(server())
        .get('/api/v1/categories')
        .query({ page: 2, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('caps the page size at the maximum allowed limit (400 beyond max)', async () => {
      const res = await request(server())
        .get('/api/v1/categories')
        .query({ limit: 1000 });
      expect(res.status).toBe(400);
    });

    it('supports search by name', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Điện thoại' });
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Laptop' });

      const res = await request(server())
        .get('/api/v1/categories')
        .query({ search: 'điện' });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Điện thoại');
    });

    it('rejects an unknown sortBy field (400, allowlist enforced)', async () => {
      const res = await request(server())
        .get('/api/v1/categories')
        .query({ sortBy: 'id; DROP TABLE categories;' });
      expect(res.status).toBe(400);
    });

    it('sorts by name descending when requested', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A danh mục' });
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Z danh mục' });

      const res = await request(server())
        .get('/api/v1/categories')
        .query({ sortBy: 'name', sortOrder: 'DESC' });

      expect(res.body.items[0].name).toBe('Z danh mục');
      expect(res.body.items[1].name).toBe('A danh mục');
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('returns the category detail', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Chi tiết' });

      const res = await request(server()).get(
        `/api/v1/categories/${created.body.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for a well-formed but non-existent id', async () => {
      const res = await request(server()).get(
        '/api/v1/categories/11111111-1111-1111-1111-111111111111',
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 (not 500) for a malformed id', async () => {
      const res = await request(server()).get('/api/v1/categories/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 for an inactive category (not exposed publicly)', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ẩn chi tiết', isActive: false });

      const res = await request(server()).get(
        `/api/v1/categories/${created.body.id}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 after the category has been soft-deleted', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sẽ bị xóa' });

      await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server()).get(
        `/api/v1/categories/${created.body.id}`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/categories/slug/:slug', () => {
    it('returns the category by slug', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Thời trang' });

      const res = await request(server()).get(
        '/api/v1/categories/slug/thoi-trang',
      );
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Thời trang');
    });

    it('returns 404 for an unknown slug', async () => {
      const res = await request(server()).get(
        '/api/v1/categories/slug/khong-ton-tai',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('ADMIN can partially update a category', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Trước khi sửa', description: 'Mô tả cũ' });

      const res = await request(server())
        .patch(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Mô tả mới' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Trước khi sửa');
      expect(res.body.description).toBe('Mô tả mới');
    });

    it('renaming does not change the slug unless slug is sent explicitly', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tên gốc' });

      const res = await request(server())
        .patch(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tên đã đổi' });

      expect(res.body.slug).toBe(created.body.slug);
    });

    it('an explicit slug change is applied', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Đổi slug' });

      const res = await request(server())
        .patch(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'slug-moi' });

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('slug-moi');
    });

    it('rejects a slug update that collides with another category (409)', async () => {
      const token = await getAdminToken();
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Danh mục A' });
      const b = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Danh mục B' });

      const res = await request(server())
        .patch(`/api/v1/categories/${b.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'danh-muc-a' });

      expect(res.status).toBe(409);
    });

    it('returns 404 when updating a non-existent category', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .patch('/api/v1/categories/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('rejects a forbidden field via whitelist (400)', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Khong duoc sua id' });

      const res = await request(server())
        .patch(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ createdAt: '2020-01-01T00:00:00.000Z' });

      expect(res.status).toBe(400);
    });

    it('CUSTOMER is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bao ve' });

      const customerToken = await getCustomerToken();
      const res = await request(server())
        .patch(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hack' });
      expect(res.status).toBe(403);
    });

    it('rejects a parent change that would create a cycle (400)', async () => {
      const token = await getAdminToken();
      const parent = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Danh mục cha' });
      const child = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Danh mục con', parentId: parent.body.id });

      const res = await request(server())
        .patch(`/api/v1/categories/${parent.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: child.body.id });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('ADMIN can soft-delete a category', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Se bi xoa' });

      const res = await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('the deleted category no longer appears in the public list', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'An bien mat' });
      await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server()).get('/api/v1/categories');
      const items = res.body.items as Array<{ id: string }>;
      expect(items.find((c) => c.id === created.body.id)).toBeUndefined();
    });

    it('the row still exists in the database with deleted_at set', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Kiem tra deleted_at' });
      await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const rows = await dataSource.query(
        'SELECT deleted_at FROM "categories" WHERE id = $1',
        [created.body.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted_at).not.toBeNull();
    });

    it('repeated deletion returns 404, not a silent success', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Xoa lap lai' });
      await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('rejects deleting a category that still has child categories (409)', async () => {
      const token = await getAdminToken();
      const parent = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Cha con' });
      await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Con cha', parentId: parent.body.id });

      const res = await request(server())
        .delete(`/api/v1/categories/${parent.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
    });

    it('returns 404 for a non-existent category', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .delete('/api/v1/categories/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('CUSTOMER is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bao ve xoa' });

      const customerToken = await getCustomerToken();
      const res = await request(server())
        .delete(`/api/v1/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('Guest is denied (401)', async () => {
      const token = await getAdminToken();
      const created = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bao ve guest' });

      const res = await request(server()).delete(
        `/api/v1/categories/${created.body.id}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
