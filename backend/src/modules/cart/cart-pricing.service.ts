import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { CartCouponRepository } from './cart-coupon.repository';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import { ClockService } from '../../common/clock/clock.service';

export interface RevalidationResult {
  discountAmount: number;
  couponRemoved: boolean;
  removedReason: string | null;
}

/**
 * The single pricing orchestration every entrypoint reuses (GET /cart,
 * add/update/delete item, apply/remove coupon) — nobody re-derives the
 * discount formula independently. Called AFTER order.items already
 * reflects the latest state, with the already-computed `subtotal` as
 * input (subtotal itself stays CartMapper's responsibility, computed from
 * items — this service never touches product/variant pricing).
 *
 * If the order has no coupon, this is a cheap no-op. If it has one, the
 * live Coupon row is re-validated against the current subtotal/time; an
 * invalid coupon is unconditionally cleared and persisted (self-healing —
 * "không được giữ discount cũ khi subtotal đã thay đổi"), and a valid one
 * has its discountAmount refreshed if the subtotal changed underneath it.
 * Runs inside the caller's transaction `manager` — never opens its own.
 */
@Injectable()
export class CartPricingService {
  constructor(
    private readonly cartCouponRepository: CartCouponRepository,
    private readonly couponValidationService: CouponValidationService,
    private readonly clock: ClockService,
  ) {}

  async revalidateCoupon(
    order: OrderEntity,
    manager: EntityManager,
  ): Promise<RevalidationResult> {
    if (!order.couponId) {
      return { discountAmount: 0, couponRemoved: false, removedReason: null };
    }

    const subtotal = order.items.reduce(
      (sum, item) => sum + item.unitPriceAmount * item.quantity,
      0,
    );

    const coupon = await this.cartCouponRepository.findCoupon(
      order.couponId,
      manager,
    );
    if (!coupon) {
      // Referential integrity guarantees this practically never happens
      // (FK is RESTRICT), but a coupon reference that cannot be resolved
      // is treated the same as "no longer valid".
      await this.cartCouponRepository.clearCoupon(order.id, manager);
      return {
        discountAmount: 0,
        couponRemoved: true,
        removedReason: 'Mã giảm giá không còn khả dụng',
      };
    }

    const result = this.couponValidationService.validate(
      coupon,
      subtotal,
      this.clock.now(),
    );

    if (!result.valid) {
      await this.cartCouponRepository.clearCoupon(order.id, manager);
      return {
        discountAmount: 0,
        couponRemoved: true,
        removedReason: result.message,
      };
    }

    if (result.discountAmount !== order.discountAmount) {
      await this.cartCouponRepository.updateDiscountAmount(
        order.id,
        result.discountAmount,
        manager,
      );
    }

    return {
      discountAmount: result.discountAmount,
      couponRemoved: false,
      removedReason: null,
    };
  }
}
