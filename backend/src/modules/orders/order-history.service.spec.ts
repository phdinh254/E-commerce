import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { OrderHistoryService } from './order-history.service';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { OrderEntity } from '../cart/entities/order.entity';
import { UserEntity } from '../users/entities/user.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderActorType } from '../cart/enums/order-actor-type.enum';

/**
 * Integration-style spec against the real test Postgres (.env.test) —
 * `record` must participate in the caller's transaction rather than opening
 * its own, which is only observable against a real DB (mocked
 * EntityManagers can't prove rollback semantics).
 */
describe('OrderHistoryService', () => {
  let dataSource: DataSource;
  let service: OrderHistoryService;
  let order: OrderEntity;

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    service = new OrderHistoryService(dataSource);

    await dataSource.query('TRUNCATE TABLE "order_status_histories" CASCADE');
    await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
    await dataSource.query('TRUNCATE TABLE "orders" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');

    const user = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `order-history-${randomUUID()}@example.com`,
        passwordHash: 'irrelevant',
        fullName: 'Order History Test User',
      }),
    );

    order = await dataSource.getRepository(OrderEntity).save(
      dataSource.getRepository(OrderEntity).create({
        userId: user.id,
        status: OrderStatus.PENDING_PAYMENT,
      }),
    );
  });

  describe('record', () => {
    it('inserts exactly one history row using the caller-supplied manager', async () => {
      const manager = dataSource.createEntityManager();
      await dataSource.transaction(async (txManager) => {
        await service.record(txManager, {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.PAID,
          actorType: OrderActorType.SYSTEM,
          actorId: null,
        });
      });
      const rows = await manager
        .getRepository(OrderStatusHistoryEntity)
        .find({ where: { orderId: order.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].toStatus).toBe(OrderStatus.PAID);
    });

    it('rolls back the history row when the enclosing transaction rolls back', async () => {
      await expect(
        dataSource.transaction(async (txManager) => {
          await service.record(txManager, {
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.PAID,
            actorType: OrderActorType.SYSTEM,
            actorId: null,
          });
          throw new Error('force rollback');
        }),
      ).rejects.toThrow();
      const rows = await dataSource
        .getRepository(OrderStatusHistoryEntity)
        .find({ where: { orderId: order.id } });
      expect(rows).toHaveLength(0);
    });

    it('truncates a reason longer than 500 characters', async () => {
      const longReason = 'x'.repeat(600);
      await dataSource.transaction(async (txManager) => {
        await service.record(txManager, {
          orderId: order.id,
          fromStatus: null,
          toStatus: OrderStatus.PAID,
          actorType: OrderActorType.SYSTEM,
          actorId: null,
          reason: longReason,
        });
      });
      const rows = await dataSource
        .getRepository(OrderStatusHistoryEntity)
        .find({ where: { orderId: order.id } });
      expect(rows[0].reason).toHaveLength(500);
    });
  });

  describe('listCustomerSafe', () => {
    it('returns rows ordered by createdAt ascending, never exposing actorId or fromStatus', async () => {
      await dataSource.transaction(async (txManager) => {
        await service.record(txManager, {
          orderId: order.id,
          fromStatus: OrderStatus.CART,
          toStatus: OrderStatus.PENDING_PAYMENT,
          actorType: OrderActorType.SYSTEM,
          actorId: null,
          reason: 'checkout:payos',
        });
      });
      await dataSource.transaction(async (txManager) => {
        await service.record(txManager, {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.PAID,
          actorType: OrderActorType.SYSTEM,
          actorId: null,
          reason: 'payment:PAYOS',
        });
      });

      const entries = await service.listCustomerSafe(order.id);

      expect(entries).toHaveLength(2);
      expect(entries[0].toStatus).toBe(OrderStatus.PENDING_PAYMENT);
      expect(entries[1].toStatus).toBe(OrderStatus.PAID);
      expect(entries[0].createdAt.getTime()).toBeLessThanOrEqual(
        entries[1].createdAt.getTime(),
      );
      for (const entry of entries) {
        expect(entry).not.toHaveProperty('actorId');
        expect(entry).not.toHaveProperty('fromStatus');
      }
    });

    it('exposes reason for CUSTOMER/SYSTEM actors and nulls it out for ADMIN actors', async () => {
      await dataSource.transaction(async (txManager) => {
        await service.record(txManager, {
          orderId: order.id,
          fromStatus: OrderStatus.PAID,
          toStatus: OrderStatus.CONFIRMED,
          actorType: OrderActorType.ADMIN,
          actorId: randomUUID(),
          reason: 'internal admin note',
        });
      });

      const entries = await service.listCustomerSafe(order.id);
      expect(entries).toHaveLength(1);
      expect(entries[0].reason).toBeNull();
    });
  });
});
