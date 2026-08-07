import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import {
  PaymentStatus,
  TERMINAL_PAYMENT_STATUSES,
} from './enums/payment-status.enum';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderActorType } from '../cart/enums/order-actor-type.enum';
import { CouponsService } from '../coupons/coupons.service';
import { OrderHistoryService } from '../orders/order-history.service';

export type ApplyResultKind = 'applied' | 'no_op' | 'ignored_terminal';

export interface ApplyProviderStatusResult {
  kind: ApplyResultKind;
  payment: PaymentEntity;
}

/**
 * The SINGLE piece of code that ever mutates Payment/Order status from a
 * provider result — both the webhook handler and the sync (reconciliation)
 * endpoint call this, never re-implementing the transition matrix
 * themselves (Ch17-B169's explicit requirement).
 *
 * Guard rules:
 *  - `payment.status === targetStatus` -> no_op (duplicate PAID webhook,
 *    retried sync — idempotent, not an error).
 *  - `payment.status` already terminal and `targetStatus` differs ->
 *    ignored_terminal (a stale/out-of-order callback can never resurrect
 *    or override a terminal Payment — most importantly, PAID never moves).
 *  - Otherwise (payment.status === PENDING) -> applied: PENDING is the
 *    only state that legally transitions anywhere.
 *
 * Coupon usage is finalized here — and ONLY here — exactly once, the
 * moment (and only the moment) Order.status actually flips to PAID. Must
 * run inside the caller's transaction `manager`.
 */
@Injectable()
export class PaymentTransitionService {
  private readonly logger = new Logger(PaymentTransitionService.name);

  constructor(
    private readonly couponsService: CouponsService,
    private readonly orderHistoryService: OrderHistoryService,
  ) {}

  async applyProviderStatus(
    payment: PaymentEntity,
    targetStatus: PaymentStatus,
    manager: EntityManager,
  ): Promise<ApplyProviderStatusResult> {
    if (payment.status === targetStatus) {
      return { kind: 'no_op', payment };
    }

    if (TERMINAL_PAYMENT_STATUSES.has(payment.status)) {
      this.logger.warn(
        `Ignored stale/out-of-order transition attempt for payment=${payment.id}: ${payment.status} -> ${targetStatus}`,
      );
      return { kind: 'ignored_terminal', payment };
    }

    // payment.status === PENDING from here on.
    const paymentRepo = manager.getRepository(PaymentEntity);
    const now = new Date();

    payment.status = targetStatus;
    if (targetStatus === PaymentStatus.PAID) payment.paidAt = now;
    if (targetStatus === PaymentStatus.CANCELLED) payment.cancelledAt = now;
    if (targetStatus === PaymentStatus.EXPIRED) payment.expiredAt = now;
    if (targetStatus === PaymentStatus.FAILED) payment.failedAt = now;
    const saved = await paymentRepo.save(payment);

    if (targetStatus === PaymentStatus.PAID) {
      await this.finalizeOrderPaid(saved, manager);
    }

    return { kind: 'applied', payment: saved };
  }

  private async finalizeOrderPaid(
    payment: PaymentEntity,
    manager: EntityManager,
  ): Promise<void> {
    const orderRepo = manager.getRepository(OrderEntity);
    const order = await orderRepo.findOne({ where: { id: payment.orderId } });
    if (!order) return; // FK guarantees this cannot happen in practice.

    // Idempotency at the Order level too: if some earlier retry already
    // flipped Order to PAID (e.g. COD's own single-transaction path),
    // don't re-run the finalize sequence.
    if (order.status === OrderStatus.PAID) return;

    const fromStatus = order.status;
    order.status = OrderStatus.PAID;
    await orderRepo.save(order);

    await this.couponsService.redeemForOrder(
      {
        id: order.id,
        couponId: order.couponId,
        discountAmount: order.discountAmount,
        couponCodeSnapshot: order.couponCodeSnapshot,
      },
      order.userId,
      manager,
    );

    await this.orderHistoryService.record(manager, {
      orderId: order.id,
      fromStatus,
      toStatus: OrderStatus.PAID,
      reason: `payment:${payment.provider}`,
      actorType: OrderActorType.SYSTEM,
      actorId: null,
    });
  }
}
