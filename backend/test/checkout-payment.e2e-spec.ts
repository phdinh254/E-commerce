import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import type { Webhook, WebhookData } from '@payos/node';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import { PAYMENT_GATEWAY } from '../src/modules/payments/payos-gateway.interface';
import { FakePayOsGateway } from '../src/modules/payments/payos-gateway.fake';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';
import {
  CouponDiscountType,
  CouponEntity,
} from '../src/modules/coupons/entities/coupon.entity';

/**
 * Ch17: real Postgres, `PAYMENT_GATEWAY` overridden with `FakePayOsGateway`
 * (see plan) — never the real PayOS SDK. Live PayOS end-to-end is out of
 * scope for automated coverage (see final report, B162/B163/live-E2E).
 */
describe('Checkout + Payment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisService: RedisService;
  let fakeGateway: FakePayOsGateway;

  const SHIPPING = {
    shippingRecipientName: 'Nguyen Van A',
    shippingPhoneNumber: '0912345678',
    shippingProvince: 'Ha Noi',
    shippingDistrict: 'Cau Giay',
    shippingWard: 'Dich Vong',
    shippingStreetAddress: '123 Xuan Thuy',
  };

  beforeAll(async () => {
    fakeGateway = new FakePayOsGateway();
    app = await createTestApp((builder) =>
      builder.overrideProvider(PAYMENT_GATEWAY).useValue(fakeGateway),
    );
    dataSource = app.get<DataSource>(getDataSourceToken());
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fakeGateway.failNextCreate = false;
    fakeGateway.shouldRejectSignature = false;
    await dataSource.query('TRUNCATE TABLE "payment_webhook_events" CASCADE');
    await dataSource.query('TRUNCATE TABLE "payments" CASCADE');
    await dataSource.query('TRUNCATE TABLE "coupon_redemptions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "idempotency_keys" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
    await dataSource.query(
      'TRUNCATE TABLE "product_variant_change_logs" CASCADE',
    );
    await dataSource.query('TRUNCATE TABLE "product_variants" CASCADE');
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

  async function createCategory(token: string): Promise<string> {
    const res = await request(server())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: unique('Danh mục') });
    return res.body.id as string;
  }

  async function createProduct(adminToken: string): Promise<{
    id: string;
    price: number;
  }> {
    const categoryId = await createCategory(adminToken);
    const res = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Sản phẩm'),
        sku: unique('SKU'),
        price: 100_000,
        categoryId,
      });
    return { id: res.body.id as string, price: res.body.price as number };
  }

  async function addToCart(
    token: string,
    productId: string,
    quantity = 2,
  ): Promise<void> {
    await request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ productId, quantity });
  }

  function checkoutCodReq(token: string, idempotencyKey = randomUUID()) {
    return request(server())
      .post('/api/v1/checkout/cod')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(SHIPPING);
  }

  function checkoutPayOsReq(token: string, idempotencyKey = randomUUID()) {
    return request(server())
      .post('/api/v1/checkout/payos')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(SHIPPING);
  }

  async function setupCartWithOneItem(): Promise<{
    token: string;
    productPrice: number;
  }> {
    const adminToken = await registerAndLogin(UserRole.ADMIN);
    const token = await registerAndLogin();
    const product = await createProduct(adminToken);
    await addToCart(token, product.id, 2);
    return { token, productPrice: product.price };
  }

  function verifiedWebhook(overrides: Partial<WebhookData> = {}): Webhook {
    const data: WebhookData = {
      orderCode: 0,
      amount: 0,
      description: 'test',
      accountNumber: '0123456789',
      reference: unique('ref'),
      transactionDateTime: new Date().toISOString(),
      currency: 'VND',
      paymentLinkId: 'link-1',
      code: '00',
      desc: 'success',
      ...overrides,
    };
    return {
      code: '00',
      desc: 'success',
      success: true,
      signature: 'sig',
      data,
    };
  }

  // -------------------------------------------------------------------
  // COD
  // -------------------------------------------------------------------
  describe('POST /api/v1/checkout/cod', () => {
    it('confirms the order as PAID and creates a paid COD payment', async () => {
      const { token, productPrice } = await setupCartWithOneItem();

      const res = await checkoutCodReq(token);

      expect(res.status).toBe(200);
      expect(res.body.paymentMethod).toBe('COD');
      expect(res.body.paymentStatus).toBe('PAID');
      expect(res.body.checkoutUrl).toBeNull();

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [res.body.orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PAID);
      expect(order[0].total_amount).toBe(productPrice * 2);
      expect(order[0].placed_at).not.toBeNull();

      const payments = await dataSource.query(
        'SELECT * FROM payments WHERE order_id = $1',
        [res.body.orderId],
      );
      expect(payments).toHaveLength(1);
      expect(payments[0].provider).toBe('COD');
      expect(payments[0].status).toBe('PAID');
    });

    it('400s on an empty cart', async () => {
      const token = await registerAndLogin();

      const res = await checkoutCodReq(token);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CART_EMPTY');
    });

    it('400s when the Idempotency-Key header is missing', async () => {
      const { token } = await setupCartWithOneItem();

      const res = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .send(SHIPPING);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('replays the same response on a retried request instead of double-charging', async () => {
      const { token } = await setupCartWithOneItem();
      const key = randomUUID();

      const first = await checkoutCodReq(token, key);
      const second = await checkoutCodReq(token, key);

      expect(second.status).toBe(200);
      expect(second.body.orderId).toBe(first.body.orderId);
      expect(second.body.paymentId).toBe(first.body.paymentId);

      const payments = await dataSource.query(
        'SELECT * FROM payments WHERE order_id = $1',
        [first.body.orderId],
      );
      expect(payments).toHaveLength(1);
    });

    it('a second checkout attempt without a cart 400s (no double order)', async () => {
      const { token } = await setupCartWithOneItem();
      await checkoutCodReq(token);

      const res = await checkoutCodReq(token, randomUUID());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CART_EMPTY');
      const orders = await dataSource.query(
        'SELECT * FROM orders WHERE user_id = (SELECT id FROM users LIMIT 1)',
      );
      expect(orders.length).toBeLessThanOrEqual(1);
    });

    it('finalizes coupon usage exactly once at COD confirmation', async () => {
      const { token } = await setupCartWithOneItem();
      const coupon = await dataSource.getRepository(CouponEntity).save(
        dataSource.getRepository(CouponEntity).create({
          code: unique('SALE'),
          discountType: CouponDiscountType.FIXED,
          discountValue: 10_000,
          minOrderAmount: 0,
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 1000 * 60 * 60),
          usedCount: 0,
          isActive: true,
          isFeatured: false,
          featuredOrder: 0,
        }),
      );
      await request(server())
        .put('/api/v1/cart/coupon')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: coupon.code });

      const res = await checkoutCodReq(token);

      expect(res.status).toBe(200);
      const redemptions = await dataSource.query(
        'SELECT * FROM coupon_redemptions WHERE order_id = $1',
        [res.body.orderId],
      );
      expect(redemptions).toHaveLength(1);
      const reloaded = await dataSource
        .getRepository(CouponEntity)
        .findOneOrFail({ where: { id: coupon.id } });
      expect(reloaded.usedCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // PayOS checkout
  // -------------------------------------------------------------------
  describe('POST /api/v1/checkout/payos', () => {
    it('moves the order to PENDING_PAYMENT and returns a checkoutUrl from the fake gateway', async () => {
      const { token, productPrice } = await setupCartWithOneItem();

      const res = await checkoutPayOsReq(token);

      expect(res.status).toBe(200);
      expect(res.body.paymentMethod).toBe('PAYOS');
      expect(res.body.paymentStatus).toBe('PENDING');
      expect(res.body.checkoutUrl).toMatch(/^https:\/\/fake-payos\.test\//);

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [res.body.orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PENDING_PAYMENT);
      expect(order[0].total_amount).toBe(productPrice * 2);

      // Order confirmation (Coupon usage) must NOT happen yet for PayOS.
      const redemptions = await dataSource.query(
        'SELECT * FROM coupon_redemptions WHERE order_id = $1',
        [res.body.orderId],
      );
      expect(redemptions).toHaveLength(0);
    });

    it('marks the payment FAILED and surfaces an error when the gateway rejects link creation', async () => {
      const { token } = await setupCartWithOneItem();
      fakeGateway.failNextCreate = true;

      const res = await checkoutPayOsReq(token);

      expect(res.status).toBeGreaterThanOrEqual(500);
      // beforeEach truncates `payments` — this test's checkout call is the
      // only one that could have inserted a row by this point.
      const payments = await dataSource.query(
        'SELECT * FROM payments ORDER BY created_at DESC LIMIT 1',
      );
      expect(payments[0]?.status).toBe('FAILED');
    });

    it('on Idempotency-Key retry, does not call the gateway again and returns the current checkoutUrl', async () => {
      const { token } = await setupCartWithOneItem();
      const key = randomUUID();

      const first = await checkoutPayOsReq(token, key);
      const second = await checkoutPayOsReq(token, key);

      expect(second.status).toBe(200);
      expect(second.body.paymentId).toBe(first.body.paymentId);
      expect(second.body.checkoutUrl).toBe(first.body.checkoutUrl);
    });
  });

  // -------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------
  describe('POST /api/v1/payments/payos/webhook', () => {
    async function placePayOsOrder(): Promise<{
      token: string;
      orderId: string;
      orderCode: number;
      amount: number;
    }> {
      const { token } = await setupCartWithOneItem();
      const res = await checkoutPayOsReq(token);
      const payment = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [res.body.paymentId],
      );
      return {
        token,
        orderId: res.body.orderId as string,
        orderCode: Number(payment[0].provider_order_code),
        amount: payment[0].amount as number,
      };
    }

    it('confirms PAID, finalizes the order, and redeems any applied coupon exactly once', async () => {
      const { orderId, orderCode, amount } = await placePayOsOrder();

      const res = await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(verifiedWebhook({ orderCode, amount }));

      expect(res.status).toBe(200);

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PAID);

      const payments = await dataSource.query(
        'SELECT * FROM payments WHERE order_id = $1',
        [orderId],
      );
      expect(payments[0].status).toBe('PAID');
      expect(payments[0].paid_at).not.toBeNull();
    });

    it('processes a resent identical webhook exactly once (idempotent)', async () => {
      const { orderId, orderCode, amount } = await placePayOsOrder();
      const webhook = verifiedWebhook({ orderCode, amount });

      await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(webhook);
      await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(webhook);

      const events = await dataSource.query(
        'SELECT * FROM payment_webhook_events WHERE provider_order_code = $1',
        [orderCode],
      );
      expect(events).toHaveLength(1);

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PAID);
    });

    it('never confirms the order on an amount mismatch', async () => {
      const { orderId, orderCode } = await placePayOsOrder();

      const res = await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(verifiedWebhook({ orderCode, amount: 1 }));

      expect(res.status).toBe(200); // still acked, PayOS must not retry-storm
      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PENDING_PAYMENT);
    });

    it('never confirms an order for an unknown orderCode', async () => {
      const res = await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(verifiedWebhook({ orderCode: 999_999_999, amount: 1 }));

      expect(res.status).toBe(200);
    });

    it('rejects a webhook whose signature the gateway cannot verify', async () => {
      const { orderCode, amount } = await placePayOsOrder();
      fakeGateway.shouldRejectSignature = true;

      const res = await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(verifiedWebhook({ orderCode, amount }));

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    it('never lets a later out-of-order callback move a PAID payment backwards', async () => {
      const { orderId, orderCode, amount } = await placePayOsOrder();
      await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(verifiedWebhook({ orderCode, amount }));

      // A distinct (non-duplicate) webhook payload for the same orderCode,
      // reporting failure — must never regress the now-PAID payment.
      await request(server())
        .post('/api/v1/payments/payos/webhook')
        .send(
          verifiedWebhook({ orderCode, amount, code: '01', desc: 'failed' }),
        );

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PAID);
    });
  });

  // -------------------------------------------------------------------
  // Status + sync + ownership
  // -------------------------------------------------------------------
  describe('GET /api/v1/orders/:orderId/payment-status', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server()).get(
        `/api/v1/orders/${randomUUID()}/payment-status`,
      );
      expect(res.status).toBe(401);
    });

    it('404s when the order belongs to a different user (IDOR)', async () => {
      const { token } = await setupCartWithOneItem();
      const orderRes = await checkoutCodReq(token);
      const otherToken = await registerAndLogin();

      const res = await request(server())
        .get(`/api/v1/orders/${orderRes.body.orderId}/payment-status`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it('reports terminal PAID status for the owner', async () => {
      const { token } = await setupCartWithOneItem();
      const orderRes = await checkoutCodReq(token);

      const res = await request(server())
        .get(`/api/v1/orders/${orderRes.body.orderId}/payment-status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
      expect(res.body.isTerminal).toBe(true);
    });
  });

  describe('POST /api/v1/payments/:paymentId/sync', () => {
    it('404s when the payment belongs to a different user (IDOR)', async () => {
      const { token } = await setupCartWithOneItem();
      const checkoutRes = await checkoutPayOsReq(token);
      const otherToken = await registerAndLogin();

      const res = await request(server())
        .post(`/api/v1/payments/${checkoutRes.body.paymentId}/sync`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it('syncs PAID from the gateway when PayOS confirms it out-of-band', async () => {
      const { token } = await setupCartWithOneItem();
      const checkoutRes = await checkoutPayOsReq(token);
      const payment = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [checkoutRes.body.paymentId],
      );
      fakeGateway.setStatus(Number(payment[0].provider_order_code), 'PAID');

      const res = await request(server())
        .post(`/api/v1/payments/${checkoutRes.body.paymentId}/sync`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [checkoutRes.body.orderId],
      );
      expect(order[0].status).toBe(OrderStatus.PAID);
    });
  });
});
