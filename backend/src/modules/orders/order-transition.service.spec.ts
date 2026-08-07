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

  const historyRepo = () =>
    dataSource.getRepository(OrderStatusHistoryEntity);

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
    );

    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
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
});
