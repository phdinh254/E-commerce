import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Cart idempotency (e2e)', () => {
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
    await dataSource.query('TRUNCATE TABLE "idempotency_keys" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "products" CASCADE');
    await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    await redisService.getClient().flushdb();
  });

  const server = () => app.getHttpServer();
  let counter = 0;
  function unique(prefix: string): string {
    counter += 1;
    return `${prefix}-${counter}-${Date.now()}`;
  }

  async function registerAndLogin(role?: UserRole): Promise<string> {
    const email = `${unique('user')}@example.com`;
    await request(server()).post('/api/v1/auth/register').send({
      email,
      password: 'StrongPass123!',
      fullName: 'Test User',
    });
    if (role) {
      await dataSource.getRepository(UserEntity).update({ email }, { role });
    }
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongPass123!' });
    return res.body.accessToken as string;
  }

  async function createProduct(adminToken: string): Promise<string> {
    const catRes = await request(server())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: unique('Danh mục') });
    const res = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Sản phẩm'),
        sku: unique('SKU'),
        price: 50_000,
        categoryId: catRes.body.id,
      });
    return res.body.id as string;
  }

  it('replays the same response for a retried request with the same key and payload — no double increment', async () => {
    const adminToken = await registerAndLogin(UserRole.ADMIN);
    const customerToken = await registerAndLogin();
    const productId = await createProduct(adminToken);
    const key = randomUUID();

    const first = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 3 });
    const second = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 3 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(second.body.items[0].quantity).toBe(3); // NOT 6

    const rows = await dataSource.query(
      'SELECT quantity FROM order_items WHERE product_id = $1',
      [productId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);
  });

  it('rejects the same key reused with a different payload', async () => {
    const adminToken = await registerAndLogin(UserRole.ADMIN);
    const customerToken = await registerAndLogin();
    const productId = await createProduct(adminToken);
    const key = randomUUID();

    const first = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 1 });
    const second = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 2 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('the same key is scoped per user — two different users can each use the same raw key string', async () => {
    const adminToken = await registerAndLogin(UserRole.ADMIN);
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const productId = await createProduct(adminToken);
    const key = randomUUID();

    const resA = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userA}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 1 });
    const resB = await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userB}`)
      .set('Idempotency-Key', key)
      .send({ productId, quantity: 1 });

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });
});
