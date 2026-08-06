import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Cart (e2e)', () => {
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

  async function createProductNoVariant(
    adminToken: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; price: number }> {
    const categoryId = await createCategory(adminToken);
    const res = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Sản phẩm'),
        sku: unique('SKU'),
        price: 100_000,
        categoryId,
        ...overrides,
      });
    return { id: res.body.id as string, price: res.body.price as number };
  }

  async function createProductWithVariant(
    adminToken: string,
  ): Promise<{ productId: string; variantId: string; variantPrice: number }> {
    const categoryId = await createCategory(adminToken);
    const productRes = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Sản phẩm biến thể'),
        sku: unique('SKU'),
        price: 100_000,
        categoryId,
      });
    const productId = productRes.body.id as string;

    const optionRes = await request(server())
      .post(`/api/v1/products/${productId}/options`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Màu sắc', values: [{ value: 'Đỏ' }] });
    const optionValueId = optionRes.body.values[0].id as string;

    const variantRes = await request(server())
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: unique('VAR-SKU'),
        price: 150_000,
        optionValueIds: [optionValueId],
      });

    return {
      productId,
      variantId: variantRes.body.id as string,
      variantPrice: variantRes.body.price as number,
    };
  }

  function addItemReq(
    token: string,
    body: Record<string, unknown>,
    idempotencyKey = randomUUID(),
  ) {
    return request(server())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
  }

  // ---------------------------------------------------------------------
  // GET /cart
  // ---------------------------------------------------------------------
  describe('GET /api/v1/cart', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server()).get('/api/v1/cart');
      expect(res.status).toBe(401);
    });

    it('returns an empty cart DTO for a user with no cart yet (no row created)', async () => {
      const token = await registerAndLogin();
      const res = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cartId).toBeNull();
      expect(res.body.items).toEqual([]);
      expect(res.body.totalQuantity).toBe(0);
      expect(res.body.subtotal).toBe(0);

      const orders = await dataSource.query('SELECT * FROM "orders"');
      expect(orders).toHaveLength(0);
    });

    it('does not leak internal fields (no deletedAt, no raw entity metadata)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      await addItemReq(customerToken, { productId: product.id, quantity: 1 });

      const res = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.body).not.toHaveProperty('deletedAt');
      expect(res.body.items[0]).not.toHaveProperty('deletedAt');
      expect(res.body.items[0]).not.toHaveProperty('orderId');
    });
  });

  // ---------------------------------------------------------------------
  // POST /cart/items
  // ---------------------------------------------------------------------
  describe('POST /api/v1/cart/items', () => {
    it('401s when not authenticated', async () => {
      const res = await request(server())
        .post('/api/v1/cart/items')
        .set('Idempotency-Key', randomUUID())
        .send({ productId: randomUUID(), quantity: 1 });
      expect(res.status).toBe(401);
    });

    it('400s when the Idempotency-Key header is missing', async () => {
      const token = await registerAndLogin();
      const product = await (async () => {
        const adminToken = await registerAndLogin(UserRole.ADMIN);
        return createProductNoVariant(adminToken);
      })();
      const res = await request(server())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 1 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('creates a cart and a line for a product without variants, using server-resolved price', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken, {
        price: 250_000,
      });

      const res = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 2,
      });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].unitPrice).toBe(250_000);
      expect(res.body.items[0].quantity).toBe(2);
      expect(res.body.totalQuantity).toBe(2);
      expect(res.body.subtotal).toBe(500_000);
    });

    it('never trusts a client-supplied price (whitelist strips unknown fields, price stays server-resolved)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken, {
        price: 100_000,
      });

      const res = await request(server())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ productId: product.id, quantity: 1, price: 1 });

      expect(res.status).toBe(400); // forbidNonWhitelisted rejects the extra field
    });

    it('adding the same product+variant again increments quantity (does not create a new line)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);

      await addItemReq(customerToken, { productId: product.id, quantity: 1 });
      const res = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 3,
      });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(4);
    });

    it('adding two different variants of the same product creates two separate lines', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const categoryId = await createCategory(adminToken);
      const productRes = await request(server())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: unique('SP'),
          sku: unique('SKU'),
          price: 100_000,
          categoryId,
        });
      const productId = productRes.body.id as string;

      const optionRes = await request(server())
        .post(`/api/v1/products/${productId}/options`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Màu sắc',
          values: [{ value: 'Đỏ' }, { value: 'Xanh' }],
        });
      const values = optionRes.body.values as { id: string }[];
      const [redId, blueId] = values.map((v) => v.id);

      const variantRed = await request(server())
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku: unique('VAR-RED'), optionValueIds: [redId] });
      const variantBlue = await request(server())
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku: unique('VAR-BLUE'), optionValueIds: [blueId] });

      await addItemReq(customerToken, {
        productId,
        variantId: variantRed.body.id,
        quantity: 1,
      });
      const cart = await addItemReq(customerToken, {
        productId,
        variantId: variantBlue.body.id,
        quantity: 1,
      });

      expect(cart.body.items).toHaveLength(2);
    });

    it('uses Variant.price, not Product.price, when a variant is given', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const { productId, variantId, variantPrice } =
        await createProductWithVariant(adminToken);

      const res = await addItemReq(customerToken, {
        productId,
        variantId,
        quantity: 1,
      });

      expect(res.body.items[0].unitPrice).toBe(variantPrice);
    });

    it('rejects a variant that does not belong to the given product', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const productA = await createProductWithVariant(adminToken);
      const productB = await createProductNoVariant(adminToken);

      const res = await addItemReq(customerToken, {
        productId: productB.id,
        variantId: productA.variantId,
        quantity: 1,
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VARIANT_NOT_FOUND');
    });

    it('rejects an inactive product', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken, {
        isActive: false,
      });

      const res = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 1,
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('requires a variantId when the product has active variants', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const { productId } = await createProductWithVariant(adminToken);

      const res = await addItemReq(customerToken, { productId, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VARIANT_REQUIRED');
    });

    it('rejects quantity 0, negative, decimal, and above the configured max', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);

      for (const quantity of [0, -1, 1.5, 100_000]) {
        const res = await addItemReq(customerToken, {
          productId: product.id,
          quantity,
        });
        expect(res.status).toBe(400);
      }
    });
  });

  // ---------------------------------------------------------------------
  // PATCH /cart/items/:itemId
  // ---------------------------------------------------------------------
  describe('PATCH /api/v1/cart/items/:itemId', () => {
    it('sets quantity to the absolute value given (not a delta)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      const addRes = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 5,
      });
      const itemId = addRes.body.items[0].itemId as string;

      const res = await request(server())
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it('404s for an item that does not exist', async () => {
      const token = await registerAndLogin();
      const res = await request(server())
        .patch(`/api/v1/cart/items/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1 });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CART_ITEM_NOT_FOUND');
    });

    it('404s (same code, no leak) for an item that belongs to another user', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      const addRes = await addItemReq(userA, {
        productId: product.id,
        quantity: 1,
      });
      const itemId = addRes.body.items[0].itemId as string;

      const res = await request(server())
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${userB}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CART_ITEM_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------------------
  // DELETE /cart/items/:itemId
  // ---------------------------------------------------------------------
  describe('DELETE /api/v1/cart/items/:itemId', () => {
    it('removes the line', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      const addRes = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 1,
      });
      const itemId = addRes.body.items[0].itemId as string;

      const delRes = await request(server())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(delRes.status).toBe(204);

      const cart = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(cart.body.items).toEqual([]);
      // The cart order row itself still exists (empty CART), per the
      // documented design decision — not deleted just because it's empty.
      expect(cart.body.cartId).toBe(addRes.body.cartId);
    });

    it('deleting an already-deleted item is a stable idempotent no-op (204 again)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const customerToken = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      const addRes = await addItemReq(customerToken, {
        productId: product.id,
        quantity: 1,
      });
      const itemId = addRes.body.items[0].itemId as string;

      await request(server())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      const second = await request(server())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(second.status).toBe(204);
    });

    it("does not delete another user's item (no rows affected, still 204, no leak)", async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      const addRes = await addItemReq(userA, {
        productId: product.id,
        quantity: 1,
      });
      const itemId = addRes.body.items[0].itemId as string;

      const delRes = await request(server())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${userB}`);
      expect(delRes.status).toBe(204);

      const cartA = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userA}`);
      expect(cartA.body.items).toHaveLength(1); // untouched
    });
  });

  // ---------------------------------------------------------------------
  // Ownership / IDOR across the board
  // ---------------------------------------------------------------------
  describe('Cross-user isolation', () => {
    it('User A cannot see User B cart items via GET', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const product = await createProductNoVariant(adminToken);
      await addItemReq(userB, { productId: product.id, quantity: 7 });

      const cartA = await request(server())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userA}`);

      expect(cartA.body.items).toEqual([]);
    });

    it('ADMIN role can also use the cart (no CUSTOMER-only restriction in this repo)', async () => {
      const adminToken = await registerAndLogin(UserRole.ADMIN);
      const product = await createProductNoVariant(adminToken);

      const res = await addItemReq(adminToken, {
        productId: product.id,
        quantity: 1,
      });

      expect(res.status).toBe(200);
    });
  });
});
