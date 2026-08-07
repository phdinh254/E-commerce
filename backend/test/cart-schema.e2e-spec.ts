import { DataSource } from 'typeorm';
import dataSource from '../src/database/data-source';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CategoryEntity } from '../src/modules/categories/entities/category.entity';
import { ProductEntity } from '../src/modules/products/entities/product.entity';
import { OrderEntity } from '../src/modules/cart/entities/order.entity';
import { OrderItemEntity } from '../src/modules/cart/entities/order-item.entity';
import { OrderStatusHistoryEntity } from '../src/modules/cart/entities/order-status-history.entity';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';
import { OrderActorType } from '../src/modules/cart/enums/order-actor-type.enum';

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

  /**
   * Chapter 19 (Order Management), Task 1 — schema-level assertions for the
   * fulfillment statuses / history actor / item snapshot migration
   * (1754500000000-AddOrderFulfillmentStatuses). Same "exercise the real
   * PostgreSQL constraints" pattern as the rest of this file.
   */
  describe('Chapter 19 Task 1 — fulfillment statuses, history actor, item snapshot', () => {
    it('rejects an order_status_histories row without actor_type (NOT NULL constraint)', async () => {
      const user = await seedUser();
      const orderRepo = ds.getRepository(OrderEntity);
      const order = await orderRepo.save(
        orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
      );

      // Raw SQL, deliberately bypassing the TypeScript entity type (which
      // requires actorType) to prove the DB itself — not just the
      // application layer — rejects a missing actor_type.
      await expect(
        ds.query(
          `INSERT INTO "order_status_histories" ("order_id", "to_status") VALUES ($1, $2)`,
          [order.id, OrderStatus.CART],
        ),
      ).rejects.toThrow(/null value in column "actor_type"|not-null constraint/i);
    });

    it.each([
      OrderActorType.CUSTOMER,
      OrderActorType.ADMIN,
      OrderActorType.SYSTEM,
    ])(
      'accepts %s as order_status_histories.actor_type',
      async (actorType) => {
        const user = await seedUser();
        const orderRepo = ds.getRepository(OrderEntity);
        const order = await orderRepo.save(
          orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
        );
        const historyRepo = ds.getRepository(OrderStatusHistoryEntity);

        const saved = await historyRepo.save(
          historyRepo.create({
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.CART,
            actorType,
            actorId: null,
          }),
        );

        expect(saved.actorType).toBe(actorType);
      },
    );

    it('accepts NULL for order_items.product_name_snapshot and sku_snapshot (populated later at checkout, not at add-to-cart time)', async () => {
      const user = await seedUser();
      const product = await seedProduct();
      const orderRepo = ds.getRepository(OrderEntity);
      const order = await orderRepo.save(
        orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
      );
      const itemRepo = ds.getRepository(OrderItemEntity);

      const saved = await itemRepo.save(
        itemRepo.create({
          orderId: order.id,
          productId: product.id,
          variantId: null,
          quantity: 1,
          unitPriceAmount: 10_000,
          // productNameSnapshot / skuSnapshot / imageUrlSnapshot
          // intentionally omitted — this is the cart-phase shape.
        }),
      );

      expect(saved.productNameSnapshot).toBeNull();
      expect(saved.skuSnapshot).toBeNull();
      expect(saved.imageUrlSnapshot).toBeNull();
    });

    it.each([
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ])(
      'accepts %s as orders.status (fulfillment status added by this migration)',
      async (status) => {
        const user = await seedUser();
        const orderRepo = ds.getRepository(OrderEntity);
        const order = await orderRepo.save(
          orderRepo.create({ userId: user.id, status: OrderStatus.CART }),
        );

        await orderRepo.update({ id: order.id }, { status });

        const reloaded = await orderRepo.findOneByOrFail({ id: order.id });
        expect(reloaded.status).toBe(status);
      },
    );

    it('creates the idx_order_status_histories_order_id_created_at index', async () => {
      const rows: Array<{ indexname: string }> = await ds.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'order_status_histories'
           AND indexname = 'idx_order_status_histories_order_id_created_at'`,
      );

      expect(rows).toHaveLength(1);
    });
  });
});
