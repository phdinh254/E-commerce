import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Product Options / Variants / Attributes (e2e)', () => {
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
    await dataSource.query(
      'TRUNCATE TABLE "product_variant_change_logs" CASCADE',
    );
    await dataSource.query(
      'TRUNCATE TABLE "product_variant_option_values" CASCADE',
    );
    await dataSource.query('TRUNCATE TABLE "product_variants" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_option_values" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_options" CASCADE');
    await dataSource.query('TRUNCATE TABLE "product_attributes" CASCADE');
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

  async function getAdminToken(): Promise<string> {
    const email = `admin-${unique('a')}@example.com`;
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
    const email = `customer-${unique('c')}@example.com`;
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

  async function createCategory(token: string): Promise<string> {
    const res = await request(server())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: unique('Danh mục') });
    return res.body.id as string;
  }

  async function createProduct(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; sku: string; price: number }> {
    const categoryId = await createCategory(token);
    const sku = unique('PARENT-SKU');
    const res = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: unique('Sản phẩm'),
        sku,
        price: 100000,
        categoryId,
        ...overrides,
      });
    return { id: res.body.id as string, sku, price: res.body.price as number };
  }

  async function createOption(
    token: string,
    productId: string,
    name: string,
    values: string[],
  ): Promise<{ id: string; values: { id: string; value: string }[] }> {
    const res = await request(server())
      .post(`/api/v1/products/${productId}/options`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name, values: values.map((value) => ({ value })) });
    return res.body;
  }

  // ---------------------------------------------------------------------
  // Options (Bài 91-92)
  // ---------------------------------------------------------------------
  describe('POST /api/v1/products/:productId/options', () => {
    it('ADMIN creates an option with values', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Màu sắc',
          values: [{ value: 'Đỏ' }, { value: 'Xanh' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Màu sắc');
      const values = res.body.values as Array<{ value: string }>;
      expect(values).toHaveLength(2);
      expect(values.map((v) => v.value)).toEqual(['Đỏ', 'Xanh']);
    });

    it('Guest is denied (401)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .send({ name: 'X', values: [{ value: 'Y' }] });
      expect(res.status).toBe(401);
    });

    it('Customer is denied (403)', async () => {
      const adminToken = await getAdminToken();
      const product = await createProduct(adminToken);
      const customerToken = await getCustomerToken();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'X', values: [{ value: 'Y' }] });
      expect(res.status).toBe(403);
    });

    it('a fake X-Role header does not bypass authorization', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('X-Role', 'ADMIN')
        .send({ name: 'X', values: [{ value: 'Y' }] });
      expect(res.status).toBe(401);
    });

    it('rejects a duplicate option name (case-insensitive) with 409', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'MÀU SẮC', values: [{ value: 'Xanh' }] });
      expect(res.status).toBe(409);
    });

    it('rejects duplicate values within one option (case-insensitive) with 409', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Màu sắc', values: [{ value: 'Đỏ' }, { value: 'đỏ' }] });
      expect(res.status).toBe(409);
    });

    it('rejects an empty values array (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Màu sắc', values: [] });
      expect(res.status).toBe(400);
    });

    it('rejects creating a new option once the product already has a variant (409)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: [color.values[0].id] });

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Kích thước', values: [{ value: 'M' }] });
      expect(res.status).toBe(409);
    });

    it('a Product not found in the URL returns 404', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/products/11111111-1111-1111-1111-111111111111/options')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', values: [{ value: 'Y' }] });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/products/:productId/options/:optionId/values', () => {
    it('ADMIN adds a value to an existing option', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/options/${color.id}/values`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'Xanh' });
      expect(res.status).toBe(201);
      expect(res.body.value).toBe('Xanh');
    });

    it('rejects adding a value to an option belonging to a different product (404)', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const color = await createOption(token, productA.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${productB.id}/options/${color.id}/values`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'Xanh' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/products/:productId/options', () => {
    it('is public and returns options with values, sorted', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await createOption(token, product.id, 'Màu sắc', ['Đỏ', 'Xanh']);

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/options`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].values).toHaveLength(2);
    });

    it('returns an empty array for a product with no options', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/options`,
      );
      expect(res.body).toEqual([]);
    });

    it('returns 404 for an inactive product (not exposed publicly)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token, { isActive: false });
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/options`,
      );
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------
  // Variants (Bài 93-94)
  // ---------------------------------------------------------------------
  describe('POST /api/v1/products/:productId/variants', () => {
    it('ADMIN creates a variant from a valid combination', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const size = await createOption(token, product.id, 'Kích thước', ['M']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: 'TSHIRT-RED-M',
          price: 249000,
          stock: 20,
          optionValueIds: [color.values[0].id, size.values[0].id],
        });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe('TSHIRT-RED-M');
      expect(res.body.price).toBe(249000);
      expect(res.body.stock).toBe(20);
      expect(res.body.optionValues).toHaveLength(2);
    });

    it('falls back to Product.price when price is omitted', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token, { price: 175000 });
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: [color.values[0].id] });

      expect(res.body.price).toBe(175000);
    });

    it('normalizes SKU to uppercase', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: 'lowercase-sku-1',
          optionValueIds: [color.values[0].id],
        });
      expect(res.body.sku).toBe('LOWERCASE-SKU-1');
    });

    it('the same combination with option value IDs in reversed order still collides (409)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const size = await createOption(token, product.id, 'Kích thước', ['M']);
      const ids = [color.values[0].id, size.values[0].id];

      await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: ids });

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: [...ids].reverse() });

      expect(res.status).toBe(409);
    });

    it('concurrency: two simultaneous requests for the exact same combination — only one succeeds', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const [resA, resB] = await Promise.all([
        request(server())
          .post(`/api/v1/products/${product.id}/variants`)
          .set('Authorization', `Bearer ${token}`)
          .send({ sku: unique('SKU-A'), optionValueIds: [color.values[0].id] }),
        request(server())
          .post(`/api/v1/products/${product.id}/variants`)
          .set('Authorization', `Bearer ${token}`)
          .send({ sku: unique('SKU-B'), optionValueIds: [color.values[0].id] }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const rows = await dataSource.query(
        'SELECT COUNT(*) FROM "product_variants" WHERE product_id = $1',
        [product.id],
      );
      expect(Number(rows[0].count)).toBe(1);
    });

    it('a missing option (product has 2 options, only 1 value sent) returns 400', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      await createOption(token, product.id, 'Kích thước', ['M']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: [color.values[0].id] });
      expect(res.status).toBe(400);
    });

    it('two values of the same option returns 400', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', [
        'Đỏ',
        'Xanh',
      ]);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          optionValueIds: [color.values[0].id, color.values[1].id],
        });
      expect(res.status).toBe(400);
    });

    it('a value belonging to a different product returns 400', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const colorA = await createOption(token, productA.id, 'Màu sắc', ['Đỏ']);
      await createOption(token, productB.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${productB.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds: [colorA.values[0].id] });
      expect(res.status).toBe(400);
    });

    it('a non-existent optionValueId returns 400', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          optionValueIds: ['11111111-1111-1111-1111-111111111111'],
        });
      expect(res.status).toBe(400);
    });

    it('duplicate IDs in the same request are rejected by DTO validation (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          optionValueIds: [color.values[0].id, color.values[0].id],
        });
      expect(res.status).toBe(400);
    });

    it('a duplicate SKU returns 409', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', [
        'Đỏ',
        'Xanh',
      ]);
      const sku = unique('SKU');
      await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku, optionValueIds: [color.values[0].id] });

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: sku.toLowerCase(), optionValueIds: [color.values[1].id] });
      expect(res.status).toBe(409);
    });

    it('a variant SKU equal to the parent Product SKU returns 400', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: product.sku, optionValueIds: [color.values[0].id] });
      expect(res.status).toBe(400);
    });

    it('a negative price is rejected (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          price: -1,
          optionValueIds: [color.values[0].id],
        });
      expect(res.status).toBe(400);
    });

    it('a negative stock is rejected (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          stock: -1,
          optionValueIds: [color.values[0].id],
        });
      expect(res.status).toBe(400);
    });

    it('a product with no options at all returns 400', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          optionValueIds: ['11111111-1111-1111-1111-111111111111'],
        });
      expect(res.status).toBe(400);
    });

    it('Customer is denied (403)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const customerToken = await getCustomerToken();

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ sku: unique('SKU'), optionValueIds: [color.values[0].id] });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/products/:productId/variants', () => {
    async function createVariant(
      token: string,
      productId: string,
      optionValueIds: string[],
      overrides: Record<string, unknown> = {},
    ) {
      return request(server())
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sku: unique('SKU'), optionValueIds, ...overrides });
    }

    it('lists active variants with their option values', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      await createVariant(token, product.id, [color.values[0].id]);

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/variants`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].optionValues[0].value).toBe('Đỏ');
    });

    it('does not include inactive variants publicly', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      await createVariant(token, product.id, [color.values[0].id], {
        isActive: false,
      });

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/variants`,
      );
      expect(res.body).toEqual([]);
    });

    it('does not leak variants from another product', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const colorA = await createOption(token, productA.id, 'Màu sắc', ['Đỏ']);
      await createVariant(token, productA.id, [colorA.values[0].id]);

      const res = await request(server()).get(
        `/api/v1/products/${productB.id}/variants`,
      );
      expect(res.body).toEqual([]);
    });

    it('an inactive product does not expose variants publicly (404)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token, { isActive: false });
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/variants`,
      );
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------
  // Price/stock update + audit (Bài 95-97)
  // ---------------------------------------------------------------------
  describe('PATCH /api/v1/products/:productId/variants/:variantId', () => {
    async function setupVariant(token: string) {
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          price: 100000,
          stock: 10,
          optionValueIds: [color.values[0].id],
        });
      return { product, variantId: created.body.id as string };
    }

    it('updates price and stock, and returns the updated variant', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 120000, stock: 25, reason: 'Nhập hàng mới' });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe(120000);
      expect(res.body.stock).toBe(25);
    });

    it('rejects an empty payload (400)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'no actual change' });
      expect(res.status).toBe(400);
    });

    it('rejects a negative price (400)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: -1, reason: 'x' });
      expect(res.status).toBe(400);
    });

    it('rejects a negative stock (400)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stock: -1, reason: 'x' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a variant that does not belong to the product in the URL', async () => {
      const token = await getAdminToken();
      const { variantId } = await setupVariant(token);
      const otherProduct = await createProduct(token);

      const res = await request(server())
        .patch(`/api/v1/products/${otherProduct.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 1000, reason: 'x' });
      expect(res.status).toBe(404);
    });

    it('a price-only change creates exactly one PRICE audit row', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);

      await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 150000, reason: 'Tăng giá' });

      const rows = await dataSource.query(
        'SELECT * FROM "product_variant_change_logs" WHERE variant_id = $1',
        [variantId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].change_type).toBe('PRICE');
      expect(rows[0].old_value).toBe(100000);
      expect(rows[0].new_value).toBe(150000);
      expect(rows[0].delta).toBe(50000);
      expect(rows[0].reason).toBe('Tăng giá');
    });

    it('a price+stock change in one request creates exactly two audit rows sharing a mutationId', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);

      await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 200000, stock: 5, reason: 'Nhập hàng + tăng giá' });

      const rows = await dataSource.query(
        'SELECT * FROM "product_variant_change_logs" WHERE variant_id = $1 ORDER BY change_type',
        [variantId],
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].change_type).toBe('PRICE');
      expect(rows[1].change_type).toBe('STOCK');
      expect(rows[0].mutation_id).toBe(rows[1].mutation_id);
    });

    it('setting price/stock to their current values creates no audit row (no-op)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 100000, stock: 10, reason: 'không đổi gì' });

      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        'SELECT * FROM "product_variant_change_logs" WHERE variant_id = $1',
        [variantId],
      );
      expect(rows).toHaveLength(0);
    });

    it("records the actor from the authenticated admin's JWT", async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const me = await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 300000, reason: 'x' });

      const rows = await dataSource.query(
        'SELECT actor_user_id FROM "product_variant_change_logs" WHERE variant_id = $1',
        [variantId],
      );
      expect(rows[0].actor_user_id).toBe(me.body.id);
    });

    it('rejects an actorUserId field in the body via DTO whitelist (400)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          price: 100001,
          reason: 'x',
          actorUserId: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('Customer is denied (403)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);
      const customerToken = await getCustomerToken();
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ price: 1, reason: 'x' });
      expect(res.status).toBe(403);
    });

    it('concurrency: two simultaneous stock updates both apply (pessimistic lock), no lost update and no orphaned audit', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariant(token);

      const [resA, resB] = await Promise.all([
        request(server())
          .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ stock: 50, reason: 'request A' }),
        request(server())
          .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ stock: 75, reason: 'request B' }),
      ]);

      expect([resA.status, resB.status]).toEqual([200, 200]);

      // The pessimistic lock serializes the two transactions — one reads
      // the pre-update stock (10) as its "old" value, the other reads
      // whatever the first one just committed. Either interleaving is
      // fine; what must never happen is a "lost update" where the final
      // stored stock doesn't match either request's intent, or a mutation
      // that ran without producing a matching audit row.
      const finalRows = await dataSource.query(
        'SELECT stock FROM "product_variants" WHERE id = $1',
        [variantId],
      );
      expect([50, 75]).toContain(finalRows[0].stock);

      const auditRows = await dataSource.query(
        'SELECT old_value, new_value FROM "product_variant_change_logs" WHERE variant_id = $1 AND change_type = \'STOCK\' ORDER BY created_at',
        [variantId],
      );
      expect(auditRows).toHaveLength(2);
      // Second row's old_value must equal the first row's new_value —
      // proves the lock serialized them onto a consistent read-then-write
      // chain instead of both reading the same stale value.
      expect(auditRows[1].old_value).toBe(auditRows[0].new_value);
    });

    it('concurrency: a stock update can never drive stock negative even under contention', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          price: 1000,
          stock: 5,
          optionValueIds: [color.values[0].id],
        });
      const variantId = created.body.id as string;

      const results = await Promise.all(
        [-1, -2, -3].map((stock) =>
          request(server())
            .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ stock, reason: 'invalid attempt' }),
        ),
      );
      expect(results.every((r) => r.status === 400)).toBe(true);

      const rows = await dataSource.query(
        'SELECT stock FROM "product_variants" WHERE id = $1',
        [variantId],
      );
      expect(rows[0].stock).toBe(5);
    });
  });

  describe('GET /api/v1/products/:productId/variants/:variantId/audit-logs', () => {
    async function setupVariantWithHistory(token: string) {
      const product = await createProduct(token);
      const color = await createOption(token, product.id, 'Màu sắc', ['Đỏ']);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/variants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: unique('SKU'),
          price: 100000,
          stock: 10,
          optionValueIds: [color.values[0].id],
        });
      const variantId = created.body.id as string;

      await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 110000, reason: 'lần 1' });
      await request(server())
        .patch(`/api/v1/products/${product.id}/variants/${variantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stock: 5, reason: 'lần 2' });

      return { product, variantId };
    }

    it('ADMIN can read the audit history, newest first', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariantWithHistory(token);

      const res = await request(server())
        .get(`/api/v1/products/${product.id}/variants/${variantId}/audit-logs`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].reason).toBe('lần 2');
      expect(res.body.items[1].reason).toBe('lần 1');
    });

    it('filters by changeType', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariantWithHistory(token);

      const res = await request(server())
        .get(`/api/v1/products/${product.id}/variants/${variantId}/audit-logs`)
        .query({ type: 'STOCK' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].changeType).toBe('STOCK');
    });

    it('Customer cannot read audit logs (403)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariantWithHistory(token);
      const customerToken = await getCustomerToken();

      const res = await request(server())
        .get(`/api/v1/products/${product.id}/variants/${variantId}/audit-logs`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('Guest cannot read audit logs (401)', async () => {
      const token = await getAdminToken();
      const { product, variantId } = await setupVariantWithHistory(token);
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/variants/${variantId}/audit-logs`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------
  // ProductAttribute (Bài 98)
  // ---------------------------------------------------------------------
  describe('Product attributes', () => {
    it('ADMIN creates an attribute', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Xuất xứ', value: 'Việt Nam' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Xuất xứ');
      expect(res.body.value).toBe('Việt Nam');
      expect(res.body.isVisible).toBe(true);
    });

    it('rejects a duplicate attribute name in the same product (409)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Xuất xứ', value: 'Việt Nam' });

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'XUẤT XỨ', value: 'Trung Quốc' });
      expect(res.status).toBe(409);
    });

    it('public GET only returns visible attributes', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hiển thị', value: 'A' });
      await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ẩn', value: 'B', isVisible: false });

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/attributes`,
      );
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Hiển thị');
    });

    it('ADMIN can update an attribute', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bảo hành', value: '12 tháng' });

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/attributes/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '24 tháng' });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('24 tháng');
    });

    it('rejects an empty PATCH payload (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', value: 'Y' });

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/attributes/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('ADMIN can soft-delete an attribute, and it disappears from public list', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sẽ xóa', value: 'X' });

      const del = await request(server())
        .delete(`/api/v1/products/${product.id}/attributes/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/attributes`,
      );
      expect(res.body).toEqual([]);
    });

    it('an attribute name can be reused after the original was deleted', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const first = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tái sử dụng', value: 'A' });
      await request(server())
        .delete(`/api/v1/products/${product.id}/attributes/${first.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const second = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tái sử dụng', value: 'B' });
      expect(second.status).toBe(201);
    });

    it('does not accept mass-assigned productId/id/createdAt (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          value: 'Y',
          id: '11111111-1111-1111-1111-111111111111',
        });
      expect(res.status).toBe(400);
    });

    it('Customer is denied write access (403)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const customerToken = await getCustomerToken();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'X', value: 'Y' });
      expect(res.status).toBe(403);
    });

    it('Guest is denied write access (401)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/attributes`)
        .send({ name: 'X', value: 'Y' });
      expect(res.status).toBe(401);
    });
  });

  // OpenAPI document verification is NOT done here: createTestApp() (see
  // test/utils/test-app.ts) does not call SwaggerModule.setup — only
  // main.ts's real bootstrap() does, matching how Chapters 8/9 verified
  // Swagger (a live server process + curl /docs-json), not through the
  // e2e Nest testing module. See the final report for that verification.
});
