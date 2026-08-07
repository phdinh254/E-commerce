import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CouponsRepository } from './coupons.repository';
import { CouponRedemptionsRepository } from './coupon-redemptions.repository';
import { ClockService } from '../../common/clock/clock.service';
import { CouponEntity } from './entities/coupon.entity';
import { FeaturedCouponResponseDto } from './dto/featured-coupon-response.dto';

/**
 * Deliberately NOT the Cart module's OrderEntity — Coupons must not import
 * from Cart (one-directional dependency: Cart imports Coupons, never the
 * reverse). The caller (Cart module) passes only the fields this operation
 * actually needs.
 */
export interface RedeemableOrder {
  id: string;
  couponId: string | null;
  discountAmount: number;
  couponCodeSnapshot: string | null;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly couponsRepository: CouponsRepository,
    private readonly redemptionsRepository: CouponRedemptionsRepository,
    private readonly clock: ClockService,
  ) {}

  findByCode(code: string): Promise<CouponEntity | null> {
    return this.couponsRepository.findByCodeUpper(code);
  }

  async getFeatured(limit: number): Promise<FeaturedCouponResponseDto[]> {
    const coupons = await this.couponsRepository.findFeatured(
      limit,
      this.clock.now(),
    );
    return coupons.map((coupon) => ({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
    }));
  }

  /**
   * Ch16-B159 domain operation — increments usage exactly once per order,
   * atomically, inside the caller's transaction. NOT called from any
   * production endpoint yet: this repository has no Order-confirmation
   * transition (CART never leaves CART — see OrderStatus). Exists so a
   * future Checkout/Payment chapter has a ready, tested integration point;
   * covered directly by unit + integration tests that invoke it manually.
   *
   * No-ops when the order has no coupon. Locks the coupon row
   * (pessimistic write) before checking usageLimit so two orders racing
   * for the last slot are serialized, not both admitted. The actual
   * duplicate-redemption guard is `UQ_coupon_redemptions_order_id`
   * (insertIfAbsent) — usedCount only increments on a genuine first
   * insert, so a retried confirmation of the same order is a safe no-op.
   */
  async redeemForOrder(
    order: RedeemableOrder,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    if (!order.couponId) return;

    const coupon = await this.couponsRepository.lockForUpdate(
      order.couponId,
      manager,
    );
    if (!coupon) return;

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new ConflictException({
        code: 'COUPON_USAGE_LIMIT_REACHED',
        message: 'Mã giảm giá đã hết lượt sử dụng',
      });
    }

    const outcome = await this.redemptionsRepository.insertIfAbsent(
      {
        couponId: order.couponId,
        orderId: order.id,
        userId,
        discountAmount: order.discountAmount,
        couponCodeSnapshot: order.couponCodeSnapshot ?? coupon.code,
      },
      manager,
    );

    if (outcome.kind === 'inserted') {
      await this.couponsRepository.incrementUsedCount(order.couponId, manager);
    }
  }

  /**
   * Exact inverse of `redeemForOrder`, for the order-cancellation path (Ch19
   * customer cancellation). Runs inside the caller's transaction so the
   * usedCount decrement and the redemption-row delete commit or roll back
   * together with the order's status change.
   *
   * Idempotent and self-guarding: the redemption row (unique per order via
   * UQ_coupon_redemptions_order_id) IS the authority for whether a decrement
   * is owed. If no row exists — the order never had a coupon, or a previous
   * cancellation already rolled it back — this is a no-op and never decrements.
   * usedCount only moves when a row is actually deleted here, so a retried
   * cancellation can never double-decrement.
   *
   * Mirrors `redeemForOrder`'s locking discipline: it takes the same
   * pessimistic write lock on the coupon row before touching usedCount, so all
   * usedCount mutations for a coupon (increments from redemptions, decrements
   * from rollbacks) serialize on that single row rather than interleaving.
   *
   * Takes only `orderId` (never an OrderEntity) to preserve the one-directional
   * dependency: Coupons must not import from Cart/Orders — the Orders side
   * calls into Coupons, never the reverse.
   */
  async rollbackRedemption(
    orderId: string,
    manager: EntityManager,
  ): Promise<void> {
    const redemption = await this.redemptionsRepository.findByOrderId(
      orderId,
      manager,
    );
    if (!redemption) return; // nothing to roll back — idempotent no-op

    await this.couponsRepository.lockForUpdate(redemption.couponId, manager);

    const deleted = await this.redemptionsRepository.deleteByOrderId(
      orderId,
      manager,
    );
    if (deleted > 0) {
      await this.couponsRepository.decrementUsedCount(
        redemption.couponId,
        manager,
      );
    }
  }
}
