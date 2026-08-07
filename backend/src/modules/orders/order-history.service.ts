import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderActorType } from '../cart/enums/order-actor-type.enum';
import { OrderHistoryEntryDto } from './dto/order-history-response.dto';

export interface RecordHistoryParams {
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  actorId: string | null;
  reason?: string;
}

/**
 * Chapter 19 — the single place that appends rows to
 * `order_status_histories`. `record` never opens its own transaction: it
 * always writes through the caller-supplied `manager` so the history row
 * lives or dies with the surrounding transaction (e.g. checkout, payment
 * confirmation). `listCustomerSafe` is the read side for customer-facing
 * order history endpoints — it strips anything that could leak internal
 * actor identity.
 */
@Injectable()
export class OrderHistoryService {
  constructor(private readonly dataSource: DataSource) {}

  async record(
    manager: EntityManager,
    params: RecordHistoryParams,
  ): Promise<OrderStatusHistoryEntity> {
    const repo = manager.getRepository(OrderStatusHistoryEntity);
    return repo.save(
      repo.create({
        orderId: params.orderId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        actorType: params.actorType,
        actorId: params.actorId,
        reason: params.reason?.slice(0, 500) ?? null,
      }),
    );
  }

  /**
   * Customer-safe read. Drops `actorId` and `fromStatus` entirely — never
   * exposed to a customer response, regardless of actor type. `reason` is
   * currently treated as customer-safe text ONLY when the actor is the
   * CUSTOMER or SYSTEM itself (e.g. 'checkout:cod', 'payment:PAYOS' — these
   * are internal tags, not admin free text) — there's no separate
   * internal-note column yet, so ADMIN-authored reasons are nulled out here
   * rather than assumed safe, since an admin note is far more likely to
   * contain content never meant for the customer.
   */
  async listCustomerSafe(orderId: string): Promise<OrderHistoryEntryDto[]> {
    const rows = await this.dataSource
      .getRepository(OrderStatusHistoryEntity)
      .find({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
    return rows.map((row) => ({
      toStatus: row.toStatus,
      createdAt: row.createdAt,
      reason:
        row.actorType === OrderActorType.CUSTOMER ||
        row.actorType === OrderActorType.SYSTEM
          ? row.reason
          : null,
    }));
  }
}
