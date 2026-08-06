import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { OrderItemEntity } from '../cart/entities/order-item.entity';

export interface PaymentLinkItemSource {
  productName: string;
  quantity: number;
  unitPriceAmount: number;
}

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
  ) {}

  /** DB-generated, unique, monotonic — never derived from Date.now() or a
   * UUID-to-number conversion. Must run inside the caller's transaction. */
  async nextOrderCode(manager: EntityManager): Promise<number> {
    const row = await manager.query<{ nextval: string }[]>(
      `SELECT nextval('payos_order_code_seq') AS nextval`,
    );
    return Number(row[0].nextval);
  }

  create(data: Partial<PaymentEntity>, manager?: EntityManager): PaymentEntity {
    const repo = manager
      ? manager.getRepository(PaymentEntity)
      : this.repository;
    return repo.create(data);
  }

  save(
    payment: PaymentEntity,
    manager?: EntityManager,
  ): Promise<PaymentEntity> {
    const repo = manager
      ? manager.getRepository(PaymentEntity)
      : this.repository;
    return repo.save(payment);
  }

  findById(id: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /** Pessimistic lock — for use inside the caller's transaction (webhook,
   * sync, or checkout retry-attempt creation). */
  findByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<PaymentEntity | null> {
    return manager.getRepository(PaymentEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findByProviderOrderCodeForUpdate(
    provider: PaymentProvider,
    providerOrderCode: number,
    manager: EntityManager,
  ): Promise<PaymentEntity | null> {
    return manager.getRepository(PaymentEntity).findOne({
      where: { provider, providerOrderCode },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Ownership-scoped read for the status endpoint (join to orders.user_id). */
  findLatestByOrderIdForUser(
    orderId: string,
    userId: string,
  ): Promise<PaymentEntity | null> {
    return this.repository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.order', 'order')
      .where('payment.order_id = :orderId', { orderId })
      .andWhere('order.user_id = :userId', { userId })
      .orderBy('payment.attempt_number', 'DESC')
      .addOrderBy('payment.created_at', 'DESC')
      .getOne();
  }

  findLatestByOrderId(orderId: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { orderId },
      order: { attemptNumber: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Ownership-scoped lock — sync endpoint locks by paymentId, not orderId. */
  findByIdForUpdateOwnedByUser(
    id: string,
    userId: string,
    manager: EntityManager,
  ): Promise<PaymentEntity | null> {
    return manager
      .getRepository(PaymentEntity)
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.order', 'order')
      .where('payment.id = :id', { id })
      .andWhere('order.user_id = :userId', { userId })
      .setLock('pessimistic_write')
      .getOne();
  }

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(fn);
  }

  /** Line items for PayOS's `items` array (display-only on their checkout
   * page) — reads through the shared DataSource manager rather than a
   * module-local repository, since OrderItemEntity is not registered via
   * `forFeature` in PaymentsModule (only OrderEntity is). */
  async findOrderItemsForPayment(
    orderId: string,
  ): Promise<PaymentLinkItemSource[]> {
    const items = await this.repository.manager
      .getRepository(OrderItemEntity)
      .find({ where: { orderId }, relations: { product: true } });
    return items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceAmount: item.unitPriceAmount,
    }));
  }
}
