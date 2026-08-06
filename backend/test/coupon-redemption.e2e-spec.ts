import { ConflictException, INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { CouponsService } from '../src/modules/coupons/coupons.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { OrderEntity } from '../src/modules/cart/entities/order.entity';
import { OrderStatus } from '../src/modules/cart/enums/order-status.enum';
import {
  CouponDiscountType,
  CouponEntity,
} from '../src/modules/coupons/entities/coupon.entity';

/**
 * Ch16-B159: `CouponsService.redeemForOrder` has NO production caller (no
 * Order-confirmation transition exists yet — see final report). These
 * tests invoke the domain operation directly against real PostgreSQL,
 * simulating what a future Checkout/Payment chapter's confirmation
 * transaction would do.
 */
describe('Coupon redemption / usage count (e2e, direct operation call)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let couponsService: CouponsService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    couponsService = app.get(CouponsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "coupon_redemptions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
  });

  async function seedUser(): Promise<UserEntity> {
    return dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
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
    return dataSource.getRepository(CouponEntity).save(
      dataSource.getRepository(CouponEntity).create({
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
    couponId: string | null,
  ): Promise<OrderEntity> {
    return dataSource.getRepository(OrderEntity).save(
      dataSource.getRepository(OrderEntity).create({
        userId,
        status: OrderStatus.CART,
        couponId,
        discountAmount: couponId ? 10_000 : 0,
        couponCodeSnapshot: couponId ? 'CODE' : null,
      }),
    );
  }

  it('no-ops for an order without a coupon', async () => {
    const user = await seedUser();
    const order = await seedOrder(user.id, null);

    await dataSource.transaction((manager) =>
      couponsService.redeemForOrder(
        {
          id: order.id,
          couponId: null,
          discountAmount: 0,
          couponCodeSnapshot: null,
        },
        user.id,
        manager,
      ),
    );

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions',
    );
    expect(redemptions).toHaveLength(0);
  });

  it('creates exactly one redemption and increments usedCount on first confirmation', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon({ usageLimit: 5, usedCount: 2 });
    const order = await seedOrder(user.id, coupon.id);

    await dataSource.transaction((manager) =>
      couponsService.redeemForOrder(
        {
          id: order.id,
          couponId: coupon.id,
          discountAmount: 10_000,
          couponCodeSnapshot: coupon.code,
        },
        user.id,
        manager,
      ),
    );

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions WHERE order_id = $1',
      [order.id],
    );
    expect(redemptions).toHaveLength(1);
    const reloaded = await dataSource
      .getRepository(CouponEntity)
      .findOneOrFail({ where: { id: coupon.id } });
    expect(reloaded.usedCount).toBe(3);
  });

  it('retrying confirmation for the same order does not double-count usage', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon({ usageLimit: null, usedCount: 0 });
    const order = await seedOrder(user.id, coupon.id);

    const redeem = () =>
      dataSource.transaction((manager) =>
        couponsService.redeemForOrder(
          {
            id: order.id,
            couponId: coupon.id,
            discountAmount: 10_000,
            couponCodeSnapshot: coupon.code,
          },
          user.id,
          manager,
        ),
      );

    await redeem();
    await redeem(); // retry — same order

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions WHERE order_id = $1',
      [order.id],
    );
    expect(redemptions).toHaveLength(1);
    const reloaded = await dataSource
      .getRepository(CouponEntity)
      .findOneOrFail({ where: { id: coupon.id } });
    expect(reloaded.usedCount).toBe(1); // NOT 2
  });

  it('rejects confirmation once the usage limit has been reached', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon({ usageLimit: 1, usedCount: 1 });
    const order = await seedOrder(user.id, coupon.id);

    await expect(
      dataSource.transaction((manager) =>
        couponsService.redeemForOrder(
          {
            id: order.id,
            couponId: coupon.id,
            discountAmount: 10_000,
            couponCodeSnapshot: coupon.code,
          },
          user.id,
          manager,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions',
    );
    expect(redemptions).toHaveLength(0);
  });

  it('two orders racing for the last usage slot: exactly one succeeds, one is rejected', async () => {
    const userA = await seedUser();
    const userB = await seedUser();
    const coupon = await seedCoupon({ usageLimit: 1, usedCount: 0 });
    const orderA = await seedOrder(userA.id, coupon.id);
    const orderB = await seedOrder(userB.id, coupon.id);

    const redeemA = dataSource.transaction((manager) =>
      couponsService.redeemForOrder(
        {
          id: orderA.id,
          couponId: coupon.id,
          discountAmount: 10_000,
          couponCodeSnapshot: coupon.code,
        },
        userA.id,
        manager,
      ),
    );
    const redeemB = dataSource.transaction((manager) =>
      couponsService.redeemForOrder(
        {
          id: orderB.id,
          couponId: coupon.id,
          discountAmount: 10_000,
          couponCodeSnapshot: coupon.code,
        },
        userB.id,
        manager,
      ),
    );

    const results = await Promise.allSettled([redeemA, redeemB]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reloaded = await dataSource
      .getRepository(CouponEntity)
      .findOneOrFail({ where: { id: coupon.id } });
    expect(reloaded.usedCount).toBe(1); // not 2 — no over-redemption

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions',
    );
    expect(redemptions).toHaveLength(1);
  });

  it('a rolled-back transaction leaves usedCount and redemptions untouched', async () => {
    const user = await seedUser();
    const coupon = await seedCoupon({ usageLimit: null, usedCount: 0 });
    const order = await seedOrder(user.id, coupon.id);

    await expect(
      dataSource.transaction(async (manager) => {
        await couponsService.redeemForOrder(
          {
            id: order.id,
            couponId: coupon.id,
            discountAmount: 10_000,
            couponCodeSnapshot: coupon.code,
          },
          user.id,
          manager,
        );
        throw new Error('simulated failure after redemption, before commit');
      }),
    ).rejects.toThrow('simulated failure');

    const redemptions = await dataSource.query(
      'SELECT * FROM coupon_redemptions',
    );
    expect(redemptions).toHaveLength(0);
    const reloaded = await dataSource
      .getRepository(CouponEntity)
      .findOneOrFail({ where: { id: coupon.id } });
    expect(reloaded.usedCount).toBe(0);
  });
});
