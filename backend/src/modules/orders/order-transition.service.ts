import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderActorType } from '../cart/enums/order-actor-type.enum';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OrderHistoryService } from './order-history.service';
import { orderNotFound, orderTransitionNotAllowed } from './order-errors';

/**
 * Chapter 19 (Order Management) — the single source of truth for which order
 * status transitions are legal. Every key maps to the set of statuses the
 * order may move to next; an empty array means the status is terminal (no
 * outgoing transitions from this service).
 *
 * The forward fulfillment path is linear and cannot be skipped:
 *   PENDING_PAYMENT -> PAID -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED.
 * PENDING_PAYMENT may also be CANCELLED (unpaid, no refund needed). DELIVERED
 * and CANCELLED are terminal. CART has no transitions here — it belongs to the
 * cart/checkout flow, and the admin transition endpoint treats a CART order as
 * not found.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CART]: [],
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderHistoryService: OrderHistoryService,
  ) {}

  /**
   * Admin/ops-driven status transition. Runs entirely inside one transaction
   * that first acquires a pessimistic write lock on the order row (matching
   * `CartRepository`'s lock-then-mutate pattern) so two concurrent admin calls
   * for the same order serialize: the second call blocks on `FOR UPDATE` until
   * the first commits, then re-reads the now-updated status and either finds
   * the transition idempotent (same target) or rejected. The order row has no
   * `version` column, so this pessimistic lock is the only concurrency guard.
   */
  async adminTransition(
    orderId: string,
    actor: AuthenticatedUser,
    toStatus: OrderStatus,
    reason?: string,
  ): Promise<OrderEntity> {
    const order = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrderEntity);
      const current = await repo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      // A missing order and a CART order are both "not found" for the admin
      // transition surface — CART belongs to the cart/checkout flow and must
      // never be transitioned here.
      if (!current || current.status === OrderStatus.CART) {
        throw orderNotFound();
      }

      // Idempotent same-status retry: if the order is already at the requested
      // status, return it unchanged without writing a duplicate history row or
      // throwing (spec §5/§10 — a retried request must not create duplicate
      // history). Checked before the transition-table check so re-issuing the
      // exact same transition is always a safe no-op, even for terminal states.
      if (current.status === toStatus) {
        return current;
      }

      const allowed = ORDER_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(toStatus)) {
        throw orderTransitionNotAllowed(current.status, toStatus);
      }

      const fromStatus = current.status;
      current.status = toStatus;
      const saved = await repo.save(current);

      await this.orderHistoryService.record(manager, {
        orderId,
        fromStatus,
        toStatus,
        actorType: OrderActorType.ADMIN,
        actorId: actor.id,
        reason,
      });

      return saved;
    });

    // TODO(Task 8): call OrderNotificationService.notifyStatusChangeIfNeeded here once it exists

    return order;
  }
}
