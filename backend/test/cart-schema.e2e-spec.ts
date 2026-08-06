import { DataSource } from 'typeorm';
import dataSource from '../src/database/data-source';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CategoryEntity } from '../src/modules/categories/entities/category.entity';
import { ProductEntity } from '../src/modules/products/entities/product.entity';
import { OrderEntity } from '../src/modules/cart/entities/order.entity';
import { OrderItemEntity } from '../src/modules/cart/entities/order-item.entity';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';

/**
 * These tests exercise real PostgreSQL constraints (not the service layer)
 * against an isolated test database — proving the DB itself, not just the
 * application code, enforces "one active CART per user" and item-line
 * uniqueness. Same pattern as category-schema.e2e-spec.ts.
 */
describe('Cart/Order schema (PostgreSQL integration)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await dataSource.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE TABLE "idempotency_keys" CASCADE');
    await ds.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await ds.query('TRUNCATE TABLE "order_items" CASCADE');
    await ds.query('TRUNCATE TABLE "orders" CASCADE');
    await ds.query('TRUNCATE TABLE "products" CASCADE');
    await ds.query('TRUNCATE TABLE "categories" CASCADE');
    await ds.query('TRUNCATE TABLE "users" CASCADE');
  });

  async function seedUser(): Promise<UserEntity> {
    return ds.getRepository(UserEntity).save(
      ds.getRepository(UserEntity).create({
        email: `u-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'x',
        fullName: 'Test',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      }),
    );
  }

  async function seedProduct(): Promise<ProductEntity> {
    const category = await ds.getRepository(CategoryEntity).save(
      ds.getRepository(CategoryEntity).create({
        name: 'Danh mục',
        slug: `dm-${Date.now()}-${Math.random()}`,
      }),
    );
    return ds.getRepository(ProductEntity).save(
      ds.getRepository(ProductEntity).create({
        categoryId: category.id,
        name: 'Sản phẩm',
        slug: `sp-${Date.now()}-${Math.random()}`,
        sku: `SKU-${Date.now()}-${Math.random()}`,
        price: 10_000,
        isActive: true,
      }),
    );
  }

  it('a second INSERT of a CART order for the same user violates the partial unique index', async () => {
    const user = await seedUser();
    const orderRepo = ds.getRepository(OrderEntity);
    await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );

    await expect(
      orderRepo.save(
        orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
      ),
    ).rejects.toThrow(/UQ_orders_user_id_active_cart|duplicate key/i);
  });

  it('does NOT block a second non-CART order for the same user (partial index only covers CART)', async () => {
    const user = await seedUser();
    const orderRepo = ds.getRepository(OrderEntity);
    await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );

    const second = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.PAID }),
    );
    expect(second.id).toBeDefined();
  });

  it('rejects a non-positive quantity via the CHECK constraint', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const orderRepo = ds.getRepository(OrderEntity);
    const order = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );
    const itemRepo = ds.getRepository(OrderItemEntity);

    await expect(
      itemRepo.save(
        itemRepo.create({
          orderId: order.id,
          productId: product.id,
          variantId: null,
          quantity: 0,
          unitPriceAmount: 10_000,
        }),
      ),
    ).rejects.toThrow(/CHK_order_items_quantity_positive|check constraint/i);
  });

  it('rejects a negative unit price via the CHECK constraint', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const orderRepo = ds.getRepository(OrderEntity);
    const order = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );
    const itemRepo = ds.getRepository(OrderItemEntity);

    await expect(
      itemRepo.save(
        itemRepo.create({
          orderId: order.id,
          productId: product.id,
          variantId: null,
          quantity: 1,
          unitPriceAmount: -1,
        }),
      ),
    ).rejects.toThrow(
      /CHK_order_items_unit_price_amount_non_negative|check constraint/i,
    );
  });

  it('rejects a second no-variant line for the same (order, product) — partial unique index', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const orderRepo = ds.getRepository(OrderEntity);
    const order = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );
    const itemRepo = ds.getRepository(OrderItemEntity);
    await itemRepo.save(
      itemRepo.create({
        orderId: order.id,
        productId: product.id,
        variantId: null,
        quantity: 1,
        unitPriceAmount: 10_000,
      }),
    );

    await expect(
      itemRepo.save(
        itemRepo.create({
          orderId: order.id,
          productId: product.id,
          variantId: null,
          quantity: 1,
          unitPriceAmount: 10_000,
        }),
      ),
    ).rejects.toThrow(
      /UQ_order_items_order_product_null_variant|duplicate key/i,
    );
  });

  it('cascades order_items delete when the parent order is deleted', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const orderRepo = ds.getRepository(OrderEntity);
    const order = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );
    const itemRepo = ds.getRepository(OrderItemEntity);
    await itemRepo.save(
      itemRepo.create({
        orderId: order.id,
        productId: product.id,
        variantId: null,
        quantity: 1,
        unitPriceAmount: 10_000,
      }),
    );

    await orderRepo.delete({ id: order.id });

    const remaining = await itemRepo.find({ where: { orderId: order.id } });
    expect(remaining).toHaveLength(0);
  });

  it('restricts deleting a product that is still referenced by an order_item', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const orderRepo = ds.getRepository(OrderEntity);
    const order = await orderRepo.save(
      orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
    );
    const itemRepo = ds.getRepository(OrderItemEntity);
    await itemRepo.save(
      itemRepo.create({
        orderId: order.id,
        productId: product.id,
        variantId: null,
        quantity: 1,
        unitPriceAmount: 10_000,
      }),
    );

    await expect(
      ds.query('DELETE FROM "products" WHERE "id" = $1', [product.id]),
    ).rejects.toThrow(/violates foreign key constraint/i);
  });
});
