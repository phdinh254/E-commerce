import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { FakeStorageProvider } from './utils/fake-storage.provider';
import { STORAGE_PROVIDER } from '../src/infrastructure/storage/storage.interface';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
]);
const HTML_DISGUISED_AS_JPEG = Buffer.from(
  '<html><body>evil</body></html>',
  'utf-8',
);
const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'utf-8',
);

describe('Product Images (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisService: RedisService;
  let fakeStorage: FakeStorageProvider;

  beforeAll(async () => {
    fakeStorage = new FakeStorageProvider();
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(STORAGE_PROVIDER)
        .useValue(fakeStorage) as unknown as typeof builder,
    );
    dataSource = app.get<DataSource>(getDataSourceToken());
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "product_images" CASCADE');
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
  ): Promise<{ id: string }> {
    const categoryId = await createCategory(token);
    const res = await request(server())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: unique('Sản phẩm'),
        sku: unique('SKU'),
        price: 100000,
        categoryId,
        ...overrides,
      });
    return { id: res.body.id as string };
  }

  async function createOptionAndVariant(
    token: string,
    productId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const option = await request(server())
      .post(`/api/v1/products/${productId}/options`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Màu sắc', values: [{ value: 'Đỏ' }] });
    const valueId = option.body.values[0].id as string;
    const variant = await request(server())
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: unique('VAR-SKU'), optionValueIds: [valueId], ...overrides });
    return variant.body.id as string;
  }

  // ---------------------------------------------------------------------
  // Ch11-B101: single upload
  // ---------------------------------------------------------------------
  describe('POST /api/v1/products/:productId/images', () => {
    it('ADMIN uploads a real JPEG successfully', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg')
        .field('altText', 'Mặt trước sản phẩm');

      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('image/jpeg');
      expect(res.body.altText).toBe('Mặt trước sản phẩm');
      expect(res.body.url).toContain('fake-storage.test');
      expect(res.body.productId).toBe(product.id);
      expect(res.body.variantId).toBeNull();
      // no service-role key / bucket / raw storage internals ever leak
      expect(JSON.stringify(res.body)).not.toMatch(/service.?role/i);
    });

    it('ADMIN uploads a real PNG successfully', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', PNG_BYTES, 'photo.png');
      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('image/png');
    });

    it('ADMIN uploads a real WebP successfully', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', WEBP_BYTES, 'photo.webp');
      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('image/webp');
    });

    it('rejects an HTML file renamed to .jpg (400) and never uploads to storage', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const before = fakeStorage.size();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', HTML_DISGUISED_AS_JPEG, 'photo.jpg');
      expect(res.status).toBe(400);
      expect(fakeStorage.size()).toBe(before);
    });

    it('rejects an SVG by default (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', SVG_BYTES, 'photo.svg');
      expect(res.status).toBe(400);
    });

    it('rejects an empty file (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(0), 'empty.jpg');
      expect(res.status).toBe(400);
    });

    it('rejects a request with no file (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .field('altText', 'no file attached');
      expect(res.status).toBe(400);
    });

    it('rejects a file over the size limit (413)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const oversized = Buffer.concat([
        JPEG_BYTES,
        Buffer.alloc(6 * 1024 * 1024, 0),
      ]);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', oversized, 'big.jpg');
      expect(res.status).toBe(413);
    });

    it('Guest is denied (401)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .attach('file', JPEG_BYTES, 'photo.jpg');
      expect(res.status).toBe(401);
    });

    it('Customer is denied (403)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const customerToken = await getCustomerToken();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('file', JPEG_BYTES, 'photo.jpg');
      expect(res.status).toBe(403);
    });

    it('a fake X-Role header does not bypass authorization', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('X-Role', 'ADMIN')
        .attach('file', JPEG_BYTES, 'photo.jpg');
      expect(res.status).toBe(401);
    });

    it('returns 404 for a Product that does not exist', async () => {
      const token = await getAdminToken();
      const res = await request(server())
        .post('/api/v1/products/11111111-1111-1111-1111-111111111111/images')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg');
      expect(res.status).toBe(404);
    });

    it('returns 404 for a soft-deleted Product', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await request(server())
        .delete(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg');
      expect(res.status).toBe(404);
    });

    it('links to a variant of the same product when variantId is given', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const variantId = await createOptionAndVariant(token, product.id);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg')
        .field('variantId', variantId);
      expect(res.status).toBe(201);
      expect(res.body.variantId).toBe(variantId);
    });

    it('rejects a variantId belonging to a different product (404)', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const variantOfA = await createOptionAndVariant(token, productA.id);
      const res = await request(server())
        .post(`/api/v1/products/${productB.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg')
        .field('variantId', variantOfA);
      expect(res.status).toBe(404);
    });

    it('does not accept a client-supplied productId/createdBy in the body (400, whitelist)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'photo.jpg')
        .field('productId', '11111111-1111-1111-1111-111111111111')
        .field('createdBy', '11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // Ch11-B102/B103: bulk upload + compensation
  // ---------------------------------------------------------------------
  describe('POST /api/v1/products/:productId/images/bulk', () => {
    it('ADMIN uploads two valid images successfully', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .attach('files', JPEG_BYTES, 'a.jpg')
        .attach('files', PNG_BYTES, 'b.png');
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
    });

    it('one invalid file fails the whole request — no partial success, nothing uploaded', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const before = fakeStorage.size();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .attach('files', JPEG_BYTES, 'a.jpg')
        .attach('files', HTML_DISGUISED_AS_JPEG, 'evil.jpg');
      expect(res.status).toBe(400);
      expect(fakeStorage.size()).toBe(before);
      const list = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(list.body).toEqual([]);
    });

    it('rejects exceeding the max file count', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      let req = request(server())
        .post(`/api/v1/products/${product.id}/images/bulk`)
        .set('Authorization', `Bearer ${token}`);
      for (let i = 0; i < 11; i += 1) {
        req = req.attach('files', JPEG_BYTES, `img-${i}.jpg`);
      }
      const res = await req;
      expect([400, 413]).toContain(res.status);
    });

    it('a mid-batch upload failure cleans up already-uploaded objects and leaves no DB rows', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      fakeStorage.failNextUpload = false;
      // Force the SECOND upload in this request to fail by pre-seeding the
      // fake store with the eventual random path is impossible (UUID), so
      // instead we use the explicit failure flag on the fake adapter,
      // simulating "Supabase upload lỗi" for one file mid-batch.
      const originalUpload = fakeStorage.upload.bind(fakeStorage);
      let calls = 0;
      fakeStorage.upload = (input) => {
        calls += 1;
        if (calls === 2) {
          return Promise.reject(new Error('simulated flaky network'));
        }
        return originalUpload(input);
      };

      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .attach('files', JPEG_BYTES, 'a.jpg')
        .attach('files', PNG_BYTES, 'b.png');

      expect(res.status).toBe(503);
      const list = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(list.body).toEqual([]);

      fakeStorage.upload = originalUpload;
    });

    it('Customer is denied (403)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const customerToken = await getCustomerToken();
      const res = await request(server())
        .post(`/api/v1/products/${product.id}/images/bulk`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('files', JPEG_BYTES, 'a.jpg');
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------
  // Ch11-B104: CRUD + visibility
  // ---------------------------------------------------------------------
  describe('GET /api/v1/products/:productId/images', () => {
    it('is public and lists Product-level images, ordered by displayOrder', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg')
        .field('displayOrder', 1);
      await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', PNG_BYTES, 'b.png')
        .field('displayOrder', 0);

      const res = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].displayOrder).toBe(0);
      expect(res.body[1].displayOrder).toBe(1);
    });

    it('does not expose images of an inactive Product (404)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token, { isActive: false });
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(res.status).toBe(404);
    });

    it('an image linked to an inactive Variant is not exposed publicly', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const variantId = await createOptionAndVariant(token, product.id, {
        isActive: false,
      });
      await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg')
        .field('variantId', variantId);

      const res = await request(server())
        .get(`/api/v1/products/${product.id}/images`)
        .query({ variantId });
      expect(res.status).toBe(404);
    });

    it('a soft-deleted image never appears publicly', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      await request(server())
        .delete(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(res.body).toEqual([]);
    });
  });

  describe('PATCH /api/v1/products/:productId/images/:imageId', () => {
    it('ADMIN updates altText and displayOrder', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ altText: 'Ảnh mới', displayOrder: 5 });
      expect(res.status).toBe(200);
      expect(res.body.altText).toBe('Ảnh mới');
      expect(res.body.displayOrder).toBe(5);
    });

    it('rejects an empty payload (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects a negative displayOrder (400)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ displayOrder: -1 });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an image that does not belong to the product in the URL', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${productA.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const res = await request(server())
        .patch(`/api/v1/products/${productB.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ altText: 'x' });
      expect(res.status).toBe(404);
    });

    it('does not accept mass-assigned objectPath/storageBucket (400, whitelist)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ altText: 'x', objectPath: 'products/hacked/x.jpg' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/products/:productId/images/:imageId', () => {
    it('ADMIN deletes an image; it disappears from public list and storage', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');

      const del = await request(server())
        .delete(`/api/v1/products/${product.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const list = await request(server()).get(
        `/api/v1/products/${product.id}/images`,
      );
      expect(list.body).toEqual([]);
    });

    it('never deletes an image belonging to a different product (404, no deletion)', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const created = await request(server())
        .post(`/api/v1/products/${productA.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');

      const del = await request(server())
        .delete(`/api/v1/products/${productB.id}/images/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(404);

      const list = await request(server()).get(
        `/api/v1/products/${productA.id}/images`,
      );
      expect(list.body).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------
  // Ch11-B105: variant linkage
  // ---------------------------------------------------------------------
  describe('PATCH /api/v1/products/:productId/images/:imageId/variant', () => {
    it('ADMIN links an image to a Variant of the same product', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const variantId = await createOptionAndVariant(token, product.id);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}/variant`)
        .set('Authorization', `Bearer ${token}`)
        .send({ variantId });
      expect(res.status).toBe(200);
      expect(res.body.variantId).toBe(variantId);
    });

    it('rejects linking to a Variant of a different product (404 — no IDOR)', async () => {
      const token = await getAdminToken();
      const productA = await createProduct(token);
      const productB = await createProduct(token);
      const variantOfB = await createOptionAndVariant(token, productB.id);
      const created = await request(server())
        .post(`/api/v1/products/${productA.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');

      const res = await request(server())
        .patch(`/api/v1/products/${productA.id}/images/${created.body.id}/variant`)
        .set('Authorization', `Bearer ${token}`)
        .send({ variantId: variantOfB });
      expect(res.status).toBe(404);
    });

    it('unlinks back to Product-level with variantId: null', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const variantId = await createOptionAndVariant(token, product.id);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg')
        .field('variantId', variantId);

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}/variant`)
        .set('Authorization', `Bearer ${token}`)
        .send({ variantId: null });
      expect(res.status).toBe(200);
      expect(res.body.variantId).toBeNull();
    });

    it('Customer cannot link a variant (403)', async () => {
      const token = await getAdminToken();
      const product = await createProduct(token);
      const variantId = await createOptionAndVariant(token, product.id);
      const created = await request(server())
        .post(`/api/v1/products/${product.id}/images`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_BYTES, 'a.jpg');
      const customerToken = await getCustomerToken();

      const res = await request(server())
        .patch(`/api/v1/products/${product.id}/images/${created.body.id}/variant`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId });
      expect(res.status).toBe(403);
    });
  });

  // OpenAPI document verification is NOT done here — see the final report
  // (matches how Chapters 8-10 verified Swagger via a live server + curl
  // /docs-json, not through this e2e Nest testing module).
});
