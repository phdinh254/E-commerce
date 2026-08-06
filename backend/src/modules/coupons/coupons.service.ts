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
}
