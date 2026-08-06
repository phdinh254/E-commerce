import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import { PAYMENT_GATEWAY } from '../src/modules/payments/payos-gateway.interface';
import { FakePayOsGateway } from '../src/modules/payments/payos-gateway.fake';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';

/**
 * Ch18: `test/address-schema.e2e-spec.ts` already covers the raw Postgres
 * constraints (partial unique default index, FK, soft delete, Unicode) —
 * this file is deliberately scoped to what that one doesn't touch: the HTTP
 * API layer (auth, ownership/IDOR, allowlist, default-address
 * orchestration through AddressesService, and checkout's use of a real
 * saved address instead of free-text fields).
 */
describe('Profile + Address (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisService: RedisService;
  let fakeGateway: FakePayOsGateway;

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
    await dataSource.query('TRUNCATE TABLE "addresses" CASCADE');
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

  function addressBody(overrides: Record<string, unknown> = {}) {
    return {
      recipientName: 'Nguyen Van A',
      phoneNumber: '0912345678',
      province: 'Ha Noi',
      district: 'Cau Giay',
      ward: 'Dich Vong',
      streetAddress: '123 Xuan Thuy',
      ...overrides,
    };
  }

  async function createAddress(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; isDefault: boolean }> {
    const res = await request(server())
      .post('/api/v1/profile/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressBody(overrides));
    return {
      id: res.body.id as string,
      isDefault: res.body.isDefault as boolean,
    };
  }

  // -------------------------------------------------------------------
  // PATCH /profile
  // -------------------------------------------------------------------
  describe('PATCH /api/v1/profile', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server())
        .patch('/api/v1/profile')
        .send({ fullName: 'New Name' });
      expect(res.status).toBe(401);
    });

    it('updates fullName for the current user only', async () => {
      const token = await registerAndLogin();

      const res = await request(server())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Nguyễn Văn Mới' });

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('Nguyễn Văn Mới');

      const me = await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(me.body.fullName).toBe('Nguyễn Văn Mới');
    });

    it('rejects email/role/status/passwordHash in the body (forbidNonWhitelisted)', async () => {
      const token = await registerAndLogin();

      const res = await request(server())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'New Name',
          email: 'hacker@evil.com',
          role: 'ADMIN',
        });

      expect(res.status).toBe(400);
    });

    it('rejects an empty fullName after trim', async () => {
      const token = await registerAndLogin();

      const res = await request(server())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: '   ' });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // Address CRUD
  // -------------------------------------------------------------------
  describe('GET/POST /api/v1/profile/addresses', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server()).get('/api/v1/profile/addresses');
      expect(res.status).toBe(401);
    });

    it('the first address is automatically the default', async () => {
      const token = await registerAndLogin();

      const res = await request(server())
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressBody());

      expect(res.status).toBe(201);
      expect(res.body.isDefault).toBe(true);
    });

    it('a second address is not default unless requested', async () => {
      const token = await registerAndLogin();
      await createAddress(token);

      const second = await request(server())
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressBody());

      expect(second.body.isDefault).toBe(false);
    });

    it('creating with isDefault=true replaces the previous default', async () => {
      const token = await registerAndLogin();
      const first = await createAddress(token);

      const second = await request(server())
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressBody({ isDefault: true }));

      expect(second.body.isDefault).toBe(true);
      const list = await request(server())
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`);
      const firstInList = (
        list.body as { id: string; isDefault: boolean }[]
      ).find((a) => a.id === first.id);
      expect(firstInList?.isDefault).toBe(false);
    });

    it('lists only the current user’s addresses, default first', async () => {
      const tokenA = await registerAndLogin();
      const tokenB = await registerAndLogin();
      await createAddress(tokenA);
      await createAddress(tokenB);

      const res = await request(server())
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.body).toHaveLength(1);
    });

    it('rejects a body carrying userId/id/createdAt (forbidNonWhitelisted)', async () => {
      const token = await registerAndLogin();

      const res = await request(server())
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressBody({ userId: randomUUID(), id: randomUUID() }));

      expect(res.status).toBe(400);
    });

    it('two concurrent creates for a brand-new user still leave exactly one default', async () => {
      const token = await registerAndLogin();

      const [a, b] = await Promise.all([
        request(server())
          .post('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${token}`)
          .send(addressBody({ recipientName: 'A' })),
        request(server())
          .post('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${token}`)
          .send(addressBody({ recipientName: 'B' })),
      ]);

      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      const defaults = [a.body.isDefault, b.body.isDefault].filter(Boolean);
      expect(defaults).toHaveLength(1);

      const list = await request(server())
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`);
      expect(
        (list.body as { isDefault: boolean }[]).filter((x) => x.isDefault),
      ).toHaveLength(1);
    });
  });

  describe('GET/PATCH/DELETE /api/v1/profile/addresses/:id (ownership)', () => {
    it('404s reading another user’s address (IDOR)', async () => {
      const tokenA = await registerAndLogin();
      const tokenB = await registerAndLogin();
      const address = await createAddress(tokenA);

      const res = await request(server())
        .get(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('404s updating another user’s address (IDOR)', async () => {
      const tokenA = await registerAndLogin();
      const tokenB = await registerAndLogin();
      const address = await createAddress(tokenA);

      const res = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientName: 'Hacked' });

      expect(res.status).toBe(404);
    });

    it('404s deleting another user’s address (IDOR)', async () => {
      const tokenA = await registerAndLogin();
      const tokenB = await registerAndLogin();
      const address = await createAddress(tokenA);

      const res = await request(server())
        .delete(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('404s setting another user’s address as default (IDOR)', async () => {
      const tokenA = await registerAndLogin();
      const tokenB = await registerAndLogin();
      const address = await createAddress(tokenA);

      const res = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}/default`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('rejects isDefault=false on update', async () => {
      const token = await registerAndLogin();
      const address = await createAddress(token);

      const res = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDefault: false });

      expect(res.status).toBe(400);
    });

    it('updates content fields for the owner', async () => {
      const token = await registerAndLogin();
      const address = await createAddress(token);

      const res = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientName: 'Updated Name', label: 'Công ty' });

      expect(res.status).toBe(200);
      expect(res.body.recipientName).toBe('Updated Name');
      expect(res.body.label).toBe('Công ty');
    });

    it('deleting the default address promotes the oldest remaining address', async () => {
      const token = await registerAndLogin();
      const first = await createAddress(token); // default
      const second = await createAddress(token);

      const del = await request(server())
        .delete(`/api/v1/profile/addresses/${first.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const detail = await request(server())
        .get(`/api/v1/profile/addresses/${second.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(detail.body.isDefault).toBe(true);
    });

    it('deleting the last address leaves the user with zero addresses and no error', async () => {
      const token = await registerAndLogin();
      const only = await createAddress(token);

      const del = await request(server())
        .delete(`/api/v1/profile/addresses/${only.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const list = await request(server())
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body).toHaveLength(0);
    });

    it('setDefault is idempotent when called twice on the same address', async () => {
      const token = await registerAndLogin();
      const address = await createAddress(token);

      const first = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}/default`)
        .set('Authorization', `Bearer ${token}`);
      const second = await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}/default`)
        .set('Authorization', `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.isDefault).toBe(true);
    });

    it('two concurrent setDefault calls on two different addresses leave exactly one default', async () => {
      const token = await registerAndLogin();
      const a = await createAddress(token);
      const b = await createAddress(token);

      await Promise.all([
        request(server())
          .patch(`/api/v1/profile/addresses/${a.id}/default`)
          .set('Authorization', `Bearer ${token}`),
        request(server())
          .patch(`/api/v1/profile/addresses/${b.id}/default`)
          .set('Authorization', `Bearer ${token}`),
      ]);

      const list = await request(server())
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${token}`);
      expect(
        (list.body as { isDefault: boolean }[]).filter((x) => x.isDefault),
      ).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // Checkout integration
  // -------------------------------------------------------------------
  describe('Checkout uses a real saved Address', () => {
    async function setupCartWithOneItem(token: string): Promise<void> {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const categoryRes = await request(server())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: unique('Danh muc') });
      const productRes = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: unique('San pham'),
          sku: unique('SKU'),
          price: 100_000,
          categoryId: categoryRes.body.id,
        });
      await request(server())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ productId: productRes.body.id, quantity: 2 });
    }

    it('400s checkout when addressId is missing', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);

      const res = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({});

      expect(res.status).toBe(400);
    });

    it('404s checkout with an address that does not exist', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);

      const res = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: randomUUID() });

      expect(res.status).toBe(404);
    });

    it('404s checkout with another user’s address (IDOR)', async () => {
      const owner = await registerAndLogin();
      const attacker = await registerAndLogin();
      await setupCartWithOneItem(attacker);
      const address = await createAddress(owner);

      const res = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${attacker}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: address.id });

      expect(res.status).toBe(404);
    });

    it('COD checkout snapshots the resolved address onto the Order', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);
      const address = await createAddress(token, {
        recipientName: 'Tran Thi B',
        streetAddress: '456 Lang Ha',
      });

      const res = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: address.id, shippingNote: 'Giao gio hanh chinh' });

      expect(res.status).toBe(200);
      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [res.body.orderId],
      );
      expect(order[0].shipping_recipient_name).toBe('Tran Thi B');
      expect(order[0].shipping_street_address).toBe('456 Lang Ha');
      expect(order[0].shipping_note).toBe('Giao gio hanh chinh');
      expect(order[0].status).toBe(OrderStatus.PAID);
    });

    it('PayOS checkout snapshots the resolved address onto the Order', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);
      const address = await createAddress(token);

      const res = await request(server())
        .post('/api/v1/checkout/payos')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: address.id });

      expect(res.status).toBe(200);
      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [res.body.orderId],
      );
      expect(order[0].shipping_recipient_name).toBe('Nguyen Van A');
      expect(order[0].status).toBe(OrderStatus.PENDING_PAYMENT);
    });

    it('editing the Address after checkout does not change the already-placed Order', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);
      const address = await createAddress(token);

      const checkoutRes = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: address.id });

      await request(server())
        .patch(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientName: 'Changed After Checkout' });

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [checkoutRes.body.orderId],
      );
      expect(order[0].shipping_recipient_name).toBe('Nguyen Van A');
    });

    it('deleting the Address after checkout does not change the already-placed Order', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);
      const address = await createAddress(token);

      const checkoutRes = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ addressId: address.id });

      const del = await request(server())
        .delete(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const order = await dataSource.query(
        'SELECT * FROM orders WHERE id = $1',
        [checkoutRes.body.orderId],
      );
      expect(order[0].shipping_recipient_name).toBe('Nguyen Van A');
      expect(order[0].shipping_street_address).toBe('123 Xuan Thuy');
    });

    it('a retried checkout (same Idempotency-Key) replays the original snapshot even if the address was since deleted', async () => {
      const token = await registerAndLogin();
      await setupCartWithOneItem(token);
      const address = await createAddress(token);
      const idempotencyKey = randomUUID();

      const first = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ addressId: address.id });

      await request(server())
        .delete(`/api/v1/profile/addresses/${address.id}`)
        .set('Authorization', `Bearer ${token}`);

      const retry = await request(server())
        .post('/api/v1/checkout/cod')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ addressId: address.id });

      expect(retry.status).toBe(200);
      expect(retry.body.orderId).toBe(first.body.orderId);
    });
  });
});
