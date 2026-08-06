import { DataSource } from 'typeorm';
import dataSource from '../src/database/data-source';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { OrderEntity } from '../src/modules/cart/entities/order.entity';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';
import {
  CouponDiscountType,
  CouponEntity,
} from '../src/modules/coupons/entities/coupon.entity';
import { CouponRedemptionEntity } from '../src/modules/coupons/entities/coupon-redemption.entity';

/**
 * Exercises real PostgreSQL constraints directly (bypassing the service
 * layer) — proves the DB itself, not just application code, enforces
 * uniqueness/FK/CHECK. Same pattern as cart-schema.e2e-spec.ts.
 */
describe('Coupon schema (PostgreSQL integration)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await dataSource.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE TABLE "coupon_redemptions" CASCADE');
    await ds.query('TRUNCATE TABLE "order_items" CASCADE');
    await ds.query('TRUNCATE TABLE "orders" CASCADE');
    await ds.query('TRUNCATE TABLE "coupons" CASCADE');
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

  async function seedCoupon(
    overrides: Partial<CouponEntity> = {},
  ): Promise<CouponEntity> {
    return ds.getRepository(CouponEntity).save(
      ds.getRepository(CouponEntity).create({
        code: `CODE-${Date.now()}-${Math.random()}`,
        discountType: CouponDiscountType.FIXED,
        discountValue: 10_000,
        minOrderAmount: 0,
        startsAt: new Date(Date.now() - 1000),
        endsAt: new Date(Date.now() + 1000 * 60 * 60),
        usedCount: 0,
        isActive: true,
        isFeatured: false,
        featuredOrder: 0,
        ...overrides,
      }),
    );
  }

  async function seedOrder(
    userId: string,
    couponId?: string,
  ): Promise<OrderEntity> {
    return ds.getRepository(OrderEntity).save(
      ds.getRepository(OrderEntity).create({
        userId,
        status: OrderStatus.CART,
        couponId: couponId ?? null,
      }),
    );
  }

  it('rejects a second redemption row for the same order (UQ_coupon_redemptions_order_id)', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon();
    const order = await seedOrder(user.id, coupon.id);
    const redemptionRepo = ds.getRepository(CouponRedemptionEntity);

    await redemptionRepo.save(
      redemptionRepo.create({
        couponId: coupon.id,
        orderId: order.id,
        userId: user.id,
        discountAmount: 10_000,
        couponCodeSnapshot: coupon.code,
      }),
    );

    await expect(
      redemptionRepo.save(
        redemptionRepo.create({
          couponId: coupon.id,
          orderId: order.id,
          userId: user.id,
          discountAmount: 10_000,
          couponCodeSnapshot: coupon.code,
        }),
      ),
    ).rejects.toThrow(/UQ_coupon_redemptions_order_id|duplicate key/i);
  });

  it('rejects a negative discountAmount on coupon_redemptions via CHECK', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon();
    const order = await seedOrder(user.id, coupon.id);
    const redemptionRepo = ds.getRepository(CouponRedemptionEntity);

    await expect(
      redemptionRepo.save(
        redemptionRepo.create({
          couponId: coupon.id,
          orderId: order.id,
          userId: user.id,
          discountAmount: -1,
          couponCodeSnapshot: coupon.code,
        }),
      ),
    ).rejects.toThrow(
      /CHK_coupon_redemptions_discount_amount_non_negative|check constraint/i,
    );
  });

  it('rejects a negative discount_amount on orders via CHECK', async () => {
    const user = await seedUser();
    await expect(
      ds.query(
        `INSERT INTO orders (user_id, status, discount_amount) VALUES ($1, 'PAID', -1)`,
        [user.id],
      ),
    ).rejects.toThrow(
      /CHK_orders_discount_amount_non_negative|check constraint/i,
    );
  });

  it('restricts deleting a Coupon still referenced by an order (FK_orders_coupon_id RESTRICT)', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon();
    await seedOrder(user.id, coupon.id);

    await expect(
      ds.query('DELETE FROM "coupons" WHERE "id" = $1', [coupon.id]),
    ).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('cascades coupon_redemptions delete when the parent order is deleted', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon();
    const order = await seedOrder(user.id, coupon.id);
    const redemptionRepo = ds.getRepository(CouponRedemptionEntity);
    await redemptionRepo.save(
      redemptionRepo.create({
        couponId: coupon.id,
        orderId: order.id,
        userId: user.id,
        discountAmount: 10_000,
        couponCodeSnapshot: coupon.code,
      }),
    );

    await ds.getRepository(OrderEntity).delete({ id: order.id });

    const remaining = await redemptionRepo.find({
      where: { orderId: order.id },
    });
    expect(remaining).toHaveLength(0);
  });

  it('the coupons.code uniqueness is case-insensitive (UQ_coupons_code_upper)', async () => {
    await seedCoupon({ code: 'SUMMER20' });
    await expect(seedCoupon({ code: 'summer20' })).rejects.toThrow(
      /UQ_coupons_code_upper|duplicate key/i,
    );
  });

  it('CHK_coupons_discount_value_valid_for_type rejects PERCENTAGE > 100', async () => {
    await expect(
      seedCoupon({
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 101,
      }),
    ).rejects.toThrow(
      /CHK_coupons_discount_value_valid_for_type|check constraint/i,
    );
  });

  it('CHK_coupons_ends_after_starts rejects endsAt <= startsAt', async () => {
    const now = new Date();
    await expect(seedCoupon({ startsAt: now, endsAt: now })).rejects.toThrow(
      /CHK_coupons_ends_after_starts|check constraint/i,
    );
  });
});
