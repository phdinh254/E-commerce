import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import {
  CouponDiscountType,
  CouponEntity,
} from '../src/modules/coupons/entities/coupon.entity';

describe('Cart Coupon (e2e)', () => {
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
    await dataSource.query('TRUNCATE TABLE "coupon_redemptions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "idempotency_keys" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
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

  async function createProduct(
    adminToken: string,
    price = 100_000,
  ): Promise<string> {
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
        price,
        categoryId: catRes.body.id,
      });
    return res.body.id as string;
  }

  async function addToCart(token: string, productId: string, quantity: number) {
    return request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ productId, quantity });
  }

  async function seedCoupon(
    overrides: Partial<CouponEntity> = {},
  ): Promise<CouponEntity> {
    const repo = dataSource.getRepository(CouponEntity);
    return repo.save(
      repo.create({
        code: unique('CODE').toUpperCase(),
        name: 'Test coupon',
        description: null,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usageLimit: null,
        perUserLimit: null,
        usedCount: 0,
        isActive: true,
        isFeatured: false,
        featuredOrder: 0,
        ...overrides,
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------
  describe('POST /api/v1/cart/coupon/preview', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server())
        .post('/api/v1/cart/coupon/preview')
        .send({ code: 'X' });
      expect(res.status).toBe(401);
    });

    it('treats "no active cart" as subtotal 0', async () => {
      const token = await registerAndLogin();
      const coupon = await seedCoupon();

      const res = await request(server())
        .post('/api/v1/cart/coupon/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(0);
    });

    it('previews a valid coupon without mutating anything', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({ discountValue: 10 });

      const res = await request(server())
        .post('/api/v1/cart/coupon/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.subtotal).toBe(500_000);
      expect(res.body.discountAmount).toBe(50_000);
      expect(res.body.total).toBe(450_000);

      // Preview must not mutate: cart has no coupon applied, usedCount unchanged.
      const cart = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token}`);
      expect(cart.body.appliedCoupon).toBeNull();
      const reloaded = await dataSource
        .getRepository(CouponEntity)
        .findOneOrFail({ where: { id: coupon.id } });
      expect(reloaded.usedCount).toBe(0);
      const redemptions = await dataSource.query(
        'SELECT * FROM coupon_redemptions',
      );
      expect(redemptions).toHaveLength(0);
    });

    it('is case-insensitive and trims whitespace', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon();

      const res = await request(server())
        .post('/api/v1/cart/coupon/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: `  ${coupon.code.toLowerCase()}  ` });

      expect(res.body.valid).toBe(true);
    });

    it('returns COUPON_NOT_FOUND for an unknown code', async () => {
      const token = await registerAndLogin();
      const res = await request(server())
        .post('/api/v1/cart/coupon/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'NOPE-XYZ' });
      expect(res.body.valid).toBe(false);
      expect(res.body.reasonCode).toBe('COUPON_NOT_FOUND');
    });

    it('returns COUPON_NOT_STARTED / COUPON_EXPIRED / COUPON_USAGE_LIMIT_REACHED / COUPON_MINIMUM_NOT_MET correctly', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 100_000);
      await addToCart(token, productId, 1);

      const notStarted = await seedCoupon({
        startsAt: new Date(Date.now() + 60_000),
      });
      const expired = await seedCoupon({
        startsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60_000),
      });
      const exhausted = await seedCoupon({ usageLimit: 1, usedCount: 1 });
      const minNotMet = await seedCoupon({ minOrderAmount: 999_999 });

      const cases: [string, string][] = [
        [notStarted.code, 'COUPON_NOT_STARTED'],
        [expired.code, 'COUPON_EXPIRED'],
        [exhausted.code, 'COUPON_USAGE_LIMIT_REACHED'],
        [minNotMet.code, 'COUPON_MINIMUM_NOT_MET'],
      ];

      for (const [code, reasonCode] of cases) {
        const res = await request(server())
          .post('/api/v1/cart/coupon/preview')
          .set('Authorization', `Bearer ${token}`)
          .send({ code });
        expect(res.body.reasonCode).toBe(reasonCode);
      }
    });
  });

  // ---------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------
  describe('PUT /api/v1/cart/coupon', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .send({ code: 'X' });
      expect(res.status).toBe(401);
    });

    it('applies a FIXED coupon and reflects it in the Cart response', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 200_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({
        discountType: CouponDiscountType.FIXED,
        discountValue: 30_000,
      });

      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      expect(res.status).toBe(200);
      expect(res.body.appliedCoupon.code).toBe(coupon.code);
      expect(res.body.discountAmount).toBe(30_000);
      expect(res.body.total).toBe(170_000);
    });

    it('applies a PERCENTAGE coupon with a maxDiscountAmount cap', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 1_000_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 50,
        maxDiscountAmount: 100_000,
      });

      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      expect(res.body.discountAmount).toBe(100_000);
    });

    it('applying the same code twice does not double the discount', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({ discountValue: 10 });

      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });
      const second = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      expect(second.body.discountAmount).toBe(50_000); // not 100,000
    });

    it('replaces the coupon when a different valid code is applied', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const couponA = await seedCoupon({ discountValue: 10 });
      const couponB = await seedCoupon({ discountValue: 20 });

      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: couponA.code });
      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: couponB.code });

      expect(res.body.appliedCoupon.code).toBe(couponB.code);
      expect(res.body.discountAmount).toBe(100_000);
    });

    it('keeps the old coupon applied when the replacement code is invalid', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const couponA = await seedCoupon({ discountValue: 10 });
      const expiredCoupon = await seedCoupon({
        startsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60_000),
      });

      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: couponA.code });
      const badApply = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: expiredCoupon.code });
      expect(badApply.status).toBe(400);

      const cart = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token}`);
      expect(cart.body.appliedCoupon.code).toBe(couponA.code);
    });

    it('404s when there is no active cart', async () => {
      const token = await registerAndLogin();
      const coupon = await seedCoupon();
      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });
      expect(res.status).toBe(404);
    });

    it('never accepts a subtotal/discountAmount/userId/cartId field from the client', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon();

      const res = await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: coupon.code,
          subtotal: 1,
          discountAmount: 999_999,
          userId: 'x',
        });

      expect(res.status).toBe(400); // forbidNonWhitelisted rejects extra fields
    });
  });

  // ---------------------------------------------------------------------
  // Remove
  // ---------------------------------------------------------------------
  describe('DELETE /api/v1/cart/coupon', () => {
    it('removes the applied coupon: discount -> 0, total == subtotal', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 300_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({ discountValue: 10 });
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      const res = await request(server())
        .delete('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appliedCoupon).toBeNull();
      expect(res.body.discountAmount).toBe(0);
      expect(res.body.total).toBe(res.body.subtotal);
    });

    it('removing twice is idempotent (no error)', async () => {
      const token = await registerAndLogin();
      const first = await request(server())
        .delete('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`);
      const second = await request(server())
        .delete('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });

    it('does not decrease usageCount and does not delete the Coupon row', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 300_000);
      await addToCart(token, productId, 1);
      const coupon = await seedCoupon({ discountValue: 10 });
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      await request(server())
        .delete('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`);

      const reloaded = await dataSource
        .getRepository(CouponEntity)
        .findOneOrFail({ where: { id: coupon.id } });
      expect(reloaded.usedCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // Cart mutation revalidation
  // ---------------------------------------------------------------------
  describe('Cart mutation revalidates the applied coupon', () => {
    it('self-removes the coupon when deleting an item drops subtotal below the minimum', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 500_000);
      const addRes = await addToCart(token, productId, 1);
      const itemId = addRes.body.items[0].itemId as string;
      const coupon = await seedCoupon({
        minOrderAmount: 400_000,
        discountValue: 10,
      });
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      const delRes = await request(server())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(204);

      const cart = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token}`);
      expect(cart.body.appliedCoupon).toBeNull();
      expect(cart.body.discountAmount).toBe(0);
    });

    it('recomputes discountAmount when quantity changes raise subtotal', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productId = await createProduct(adminToken, 100_000);
      const addRes = await addToCart(token, productId, 1);
      const itemId = addRes.body.items[0].itemId as string;
      const coupon = await seedCoupon({ discountValue: 10 });
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      const patchRes = await request(server())
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 3 });

      expect(patchRes.body.subtotal).toBe(300_000);
      expect(patchRes.body.discountAmount).toBe(30_000);
    });

    it('recomputes discountAmount after adding another item', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const token = await registerAndLogin();
      const productA = await createProduct(adminToken, 100_000);
      const productB = await createProduct(adminToken, 200_000);
      await addToCart(token, productA, 1);
      const coupon = await seedCoupon({ discountValue: 10 });
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      const addRes = await addToCart(token, productB, 1);

      expect(addRes.body.subtotal).toBe(300_000);
      expect(addRes.body.discountAmount).toBe(30_000);
    });
  });

  // ---------------------------------------------------------------------
  // Ownership / IDOR
  // ---------------------------------------------------------------------
  describe('Cross-user isolation', () => {
    it("User A's applied coupon never appears in User B's cart", async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const productId = await createProduct(adminToken, 300_000);
      await addToCart(userA, productId, 1);
      const coupon = await seedCoupon();
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${userA}`)
        .send({ code: coupon.code });

      const cartB = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userB}`);
      expect(cartB.body.appliedCoupon).toBeNull();
    });
  });
});
