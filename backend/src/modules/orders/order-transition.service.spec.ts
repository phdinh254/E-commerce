import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import {
  ORDER_TRANSITIONS,
  OrderTransitionService,
} from './order-transition.service';
import { OrderHistoryService } from './order-history.service';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { UserEntity } from '../users/entities/user.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderActorType } from '../cart/enums/order-actor-type.enum';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/enums/user-role.enum';
import { CouponsService } from '../coupons/coupons.service';
import { CouponsRepository } from '../coupons/coupons.repository';
import { CouponRedemptionsRepository } from '../coupons/coupon-redemptions.repository';
import { ClockService } from '../../common/clock/clock.service';
import {
  CouponDiscountType,
  CouponEntity,
} from '../coupons/entities/coupon.entity';
import { CouponRedemptionEntity } from '../coupons/entities/coupon-redemption.entity';

/**
 * Integration-style spec against the real test Postgres (.env.test) — the
 * pessimistic row lock that serializes concurrent admin transitions is only
 * observable against a real DB (a mocked EntityManager cannot prove that the
 * second transaction blocks on FOR UPDATE until the first commits).
 */
describe('OrderTransitionService', () => {
  let dataSource: DataSource;
  let service: OrderTransitionService;
  let adminUser: AuthenticatedUser;
  let customerUser: UserEntity;
  let otherUser: UserEntity;

  const historyRepo = () =>
    dataSource.getRepository(OrderStatusHistoryEntity);
  const couponsRepo = () => dataSource.getRepository(CouponEntity);

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    service = new OrderTransitionService(
      dataSource,
      new OrderHistoryService(dataSource),
      new CouponsService(
        new CouponsRepository(dataSource.getRepository(CouponEntity)),
        new CouponRedemptionsRepository(),
        new ClockService(),
      ),
    );

    await dataSource.query('TRUNCATE TABLE "coupon_redemptions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');

    const admin = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `order-transition-admin-${randomUUID()}@example.com`,
        passwordHash: 'irrelevant',
        fullName: 'Order Transition Admin',
        role: UserRole.ADMIN,
      }),
    );
    adminUser = { id: admin.id, email: admin.email, role: UserRole.ADMIN };

    customerUser = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `order-transition-owner-${randomUUID()}@example.com`,
        passwordHash: 'irrelevant',
        fullName: 'Order Transition Owner',
        role: UserRole.CUSTOMER,
      }),
    );

    otherUser = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `order-transition-other-${randomUUID()}@example.com`,
        passwordHash: 'irrelevant',
        fullName: 'Order Transition Other',
        role: UserRole.CUSTOMER,
      }),
    );
  });

  async function createOrderFixture(status: OrderStatus): Promise<OrderEntity> {
    const user = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `order-transition-cust-${randomUUID()}@example.com`,
        passwordHash: 'irrelevant',
        fullName: 'Order Transition Customer',
      }),
    );
    return dataSource.getRepository(OrderEntity).save(
      dataSource.getRepository(OrderEntity).create({
        userId: user.id,
        status,
      }),
    );
  }

  const createPaidOrderFixture = () => createOrderFixture(OrderStatus.PAID);
  const createDeliveredOrderFixture = () =>
    createOrderFixture(OrderStatus.DELIVERED);

  // Owner-scoped fixtures for the customer cancellation surface: unlike
  // `createOrderFixture` (which mints a throwaway user per order), these attach
  // the order to a caller-supplied user so ownership can be exercised.
  function createOrderForUser(
    userId: string,
    status: OrderStatus,
    overrides: Partial<OrderEntity> = {},
  ): Promise<OrderEntity> {
    return dataSource.getRepository(OrderEntity).save(
      dataSource.getRepository(OrderEntity).create({
        userId,
        status,
        ...overrides,
      }),
    );
  }

  const createPendingPaymentOrderFixture = (userId: string) =>
    createOrderForUser(userId, OrderStatus.PENDING_PAYMENT);

  async function seedCoupon(
    overrides: Partial<CouponEntity> = {},
  ): Promise<CouponEntity> {
    return couponsRepo().save(
      couponsRepo().create({
        code: `CODE-${randomUUID()}`,
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

  // A PENDING_PAYMENT order that has already redeemed a coupon: the order
  // carries the coupon snapshot fields AND there is a matching
  // coupon_redemptions row (the invariant redeemForOrder establishes), so
  // rollback has something real to undo.
  async function createPendingPaymentOrderWithCouponFixture(
    userId: string,
    coupon: CouponEntity,
  ): Promise<OrderEntity> {
    const order = await createOrderForUser(userId, OrderStatus.PENDING_PAYMENT, {
      couponId: coupon.id,
      discountAmount: 10_000,
      couponCodeSnapshot: coupon.code,
    });
    await dataSource.getRepository(CouponRedemptionEntity).save(
      dataSource.getRepository(CouponRedemptionEntity).create({
        couponId: coupon.id,
        orderId: order.id,
        userId,
        discountAmount: 10_000,
        couponCodeSnapshot: coupon.code,
      }),
    );
    return order;
  }

  describe('ORDER_TRANSITIONS table', () => {
    it('allows PAID -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.PAID]).toContain(
        OrderStatus.CONFIRMED,
      );
      expect(ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toContain(
        OrderStatus.PROCESSING,
      );
      expect(ORDER_TRANSITIONS[OrderStatus.PROCESSING]).toContain(
        OrderStatus.SHIPPED,
      );
      expect(ORDER_TRANSITIONS[OrderStatus.SHIPPED]).toContain(
        OrderStatus.DELIVERED,
      );
    });

    it('allows PENDING_PAYMENT -> PAID and PENDING_PAYMENT -> CANCELLED', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.PENDING_PAYMENT]).toEqual(
        expect.arrayContaining([OrderStatus.PAID, OrderStatus.CANCELLED]),
      );
    });

    it('has no outgoing transitions from CART, DELIVERED or CANCELLED', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.CART]).toEqual([]);
      expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
      expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
    });

    it('does not allow skipping PROCESSING (PAID -> SHIPPED)', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.PAID]).not.toContain(
        OrderStatus.SHIPPED,
      );
    });
  });

  describe('adminTransition', () => {
    it('moves PAID order to CONFIRMED and records ADMIN-actor history in one transaction', async () => {
      const order = await createPaidOrderFixture();
      const result = await service.adminTransition(
        order.id,
        adminUser,
        OrderStatus.CONFIRMED,
      );
      expect(result.status).toBe(OrderStatus.CONFIRMED);

      const history = await historyRepo().find({
        where: { orderId: order.id },
        order: { createdAt: 'DESC' },
      });
      expect(history[0].toStatus).toBe(OrderStatus.CONFIRMED);
      expect(history[0].fromStatus).toBe(OrderStatus.PAID);
      expect(history[0].actorType).toBe(OrderActorType.ADMIN);
      expect(history[0].actorId).toBe(adminUser.id);
    });

    it('persists the new status to the database', async () => {
      const order = await createPaidOrderFixture();
      await service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED);
      const reloaded = await dataSource
        .getRepository(OrderEntity)
        .findOneByOrFail({ id: order.id });
      expect(reloaded.status).toBe(OrderStatus.CONFIRMED);
    });

    it('rejects PAID -> SHIPPED with ORDER_TRANSITION_NOT_ALLOWED (409)', async () => {
      const order = await createPaidOrderFixture();
      await expect(
        service.adminTransition(order.id, adminUser, OrderStatus.SHIPPED),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ORDER_TRANSITION_NOT_ALLOWED' },
      });
    });

    it('rejects transition from terminal DELIVERED', async () => {
      const order = await createDeliveredOrderFixture();
      await expect(
        service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ORDER_TRANSITION_NOT_ALLOWED' },
      });
    });

    it('returns ORDER_NOT_FOUND (404) for a non-existent order', async () => {
      await expect(
        service.adminTransition(randomUUID(), adminUser, OrderStatus.CONFIRMED),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ORDER_NOT_FOUND' },
      });
    });

    it('treats a CART order as not found (never transitionable by admin)', async () => {
      const order = await createOrderFixture(OrderStatus.CART);
      await expect(
        service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ORDER_NOT_FOUND' },
      });
    });

    it('is idempotent when the order is already at the target status (no new history, no throw)', async () => {
      const order = await createOrderFixture(OrderStatus.CONFIRMED);
      const result = await service.adminTransition(
        order.id,
        adminUser,
        OrderStatus.CONFIRMED,
      );
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      const count = await historyRepo().count({
        where: { orderId: order.id },
      });
      expect(count).toBe(0);
    });

    it('locks the order row before deciding the transition (concurrent admin calls yield exactly one history row)', async () => {
      const order = await createPaidOrderFixture();
      const results = await Promise.allSettled([
        service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
        service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      // Both may resolve (one real transition + one idempotent same-status
      // retry), but there must be exactly one CONFIRMED history row.
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      const historyCount = await historyRepo().count({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(historyCount).toBe(1);
    });
  });

  describe('cancelByCustomer', () => {
    it('cancels own PENDING_PAYMENT order and records CUSTOMER-actor history', async () => {
      const order = await createPendingPaymentOrderFixture(customerUser.id);

      const result = await service.cancelByCustomer(
        order.id,
        customerUser.id,
        'Changed my mind',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);

      const reloaded = await dataSource
        .getRepository(OrderEntity)
        .findOneByOrFail({ id: order.id });
      expect(reloaded.status).toBe(OrderStatus.CANCELLED);

      const history = await historyRepo().find({
        where: { orderId: order.id },
        order: { createdAt: 'DESC' },
      });
      expect(history[0].toStatus).toBe(OrderStatus.CANCELLED);
      expect(history[0].fromStatus).toBe(OrderStatus.PENDING_PAYMENT);
      expect(history[0].actorType).toBe(OrderActorType.CUSTOMER);
      expect(history[0].actorId).toBe(customerUser.id);
      expect(history[0].reason).toBe('Changed my mind');
    });

    it("rejects cancelling another user's order with ORDER_NOT_FOUND (404, anti-enumeration)", async () => {
      const order = await createPendingPaymentOrderFixture(otherUser.id);

      await expect(
        service.cancelByCustomer(order.id, customerUser.id),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ORDER_NOT_FOUND' },
      });

      // Untouched — a non-owner call must not mutate the order.
      const reloaded = await dataSource
        .getRepository(OrderEntity)
        .findOneByOrFail({ id: order.id });
      expect(reloaded.status).toBe(OrderStatus.PENDING_PAYMENT);
    });

    it('returns ORDER_NOT_FOUND (404) for a non-existent order', async () => {
      await expect(
        service.cancelByCustomer(randomUUID(), customerUser.id),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ORDER_NOT_FOUND' },
      });
    });

    it('treats a CART order as not found (never self-cancellable)', async () => {
      const order = await createOrderForUser(customerUser.id, OrderStatus.CART);

      await expect(
        service.cancelByCustomer(order.id, customerUser.id),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ORDER_NOT_FOUND' },
      });
    });

    it('rejects cancelling a PAID order with ORDER_REFUND_REQUIRED (409)', async () => {
      // COD path lands directly in PAID — PAID is PAID regardless of how it
      // got there, so this also covers the COD case.
      const order = await createOrderForUser(customerUser.id, OrderStatus.PAID);

      await expect(
        service.cancelByCustomer(order.id, customerUser.id),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ORDER_REFUND_REQUIRED' },
      });
    });

    it('rejects cancelling CONFIRMED/PROCESSING/SHIPPED/DELIVERED orders with ORDER_REFUND_REQUIRED (409)', async () => {
      for (const status of [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ]) {
        const order = await createOrderForUser(customerUser.id, status);
        await expect(
          service.cancelByCustomer(order.id, customerUser.id),
        ).rejects.toMatchObject({
          status: 409,
          response: { code: 'ORDER_REFUND_REQUIRED' },
        });
      }
    });

    it('cancel retry after success is idempotent: no duplicate history, no error', async () => {
      const order = await createPendingPaymentOrderFixture(customerUser.id);

      await service.cancelByCustomer(order.id, customerUser.id);
      const second = await service.cancelByCustomer(order.id, customerUser.id);

      expect(second.status).toBe(OrderStatus.CANCELLED);
      const count = await historyRepo().count({
        where: { orderId: order.id, toStatus: OrderStatus.CANCELLED },
      });
      expect(count).toBe(1);
    });

    it('cancels cleanly when the order has no coupon (rollback is a no-op)', async () => {
      const order = await createPendingPaymentOrderFixture(customerUser.id);

      await expect(
        service.cancelByCustomer(order.id, customerUser.id),
      ).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    });

    it('rolls back coupon usage exactly once on cancellation, even on retry', async () => {
      const coupon = await seedCoupon({ usageLimit: 10, usedCount: 3 });
      const order = await createPendingPaymentOrderWithCouponFixture(
        customerUser.id,
        coupon,
      );

      await service.cancelByCustomer(order.id, customerUser.id);
      await service.cancelByCustomer(order.id, customerUser.id); // retry

      const reloaded = await couponsRepo().findOneByOrFail({ id: coupon.id });
      expect(reloaded.usedCount).toBe(2); // decremented exactly once, not twice

      const redemptions = await dataSource.query(
        'SELECT * FROM coupon_redemptions WHERE order_id = $1',
        [order.id],
      );
      expect(redemptions).toHaveLength(0);
    });
  });
});
