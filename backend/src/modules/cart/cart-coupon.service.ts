import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { CartCouponRepository } from './cart-coupon.repository';
import { CartService } from './cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import { ClockService } from '../../common/clock/clock.service';
import { CouponPreviewResponseDto } from '../coupons/dto/coupon-preview-response.dto';
import { CartResponseDto } from './dto/cart-response.dto';

@Injectable()
export class CartCouponService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly cartCouponRepository: CartCouponRepository,
    private readonly cartService: CartService,
    private readonly couponsService: CouponsService,
    private readonly couponValidationService: CouponValidationService,
    private readonly clock: ClockService,
  ) {}

  /** Never mutates Order/Coupon/CouponRedemption/OrderStatusHistory. */
  async previewCoupon(
    userId: string,
    code: string,
  ): Promise<CouponPreviewResponseDto> {
    const order = await this.cartRepository.findActiveCartWithItems(userId);
    const subtotal = this.subtotalOf(order?.items ?? []);

    const coupon = await this.couponsService.findByCode(code);
    if (!coupon) {
      return {
        code,
        valid: false,
        discountType: null,
        discountValue: null,
        subtotal,
        discountAmount: 0,
        total: subtotal,
        reasonCode: 'COUPON_NOT_FOUND',
        message: 'Mã giảm giá không hợp lệ',
      };
    }

    const result = this.couponValidationService.validate(
      coupon,
      subtotal,
      this.clock.now(),
    );

    return {
      code: coupon.code,
      valid: result.valid,
      discountType: result.valid ? coupon.discountType : null,
      discountValue: result.valid ? coupon.discountValue : null,
      subtotal,
      discountAmount: result.discountAmount,
      total: result.total,
      reasonCode: result.reasonCode,
      message: result.message,
    };
  }

  /**
   * Replaces (or sets) the Cart's coupon only if the new code validates —
   * an invalid new code never touches the row, so a previously-applied
   * valid coupon survives untouched (no partial state possible, since the
   * write only happens after validation succeeds, inside one transaction).
   */
  async applyCoupon(userId: string, code: string): Promise<CartResponseDto> {
    const order = await this.cartRepository.findActiveCartWithItems(userId);
    if (!order) {
      throw new NotFoundException({
        code: 'CART_NOT_FOUND',
        message: 'Chưa có giỏ hàng để áp dụng mã giảm giá',
      });
    }

    const coupon = await this.couponsService.findByCode(code);
    if (!coupon) {
      throw new NotFoundException({
        code: 'COUPON_NOT_FOUND',
        message: 'Mã giảm giá không hợp lệ',
      });
    }

    const subtotal = this.subtotalOf(order.items);
    const result = this.couponValidationService.validate(
      coupon,
      subtotal,
      this.clock.now(),
    );

    if (!result.valid) {
      throw new BadRequestException({
        code: result.reasonCode,
        message: result.message,
      });
    }

    await this.cartRepository.runInTransaction(async (manager) => {
      await this.cartCouponRepository.lockOrder(order.id, manager);
      await this.cartCouponRepository.setCoupon(
        order.id,
        {
          couponId: coupon.id,
          couponCodeSnapshot: coupon.code.toUpperCase(),
          couponNameSnapshot: coupon.name,
          couponDiscountTypeSnapshot: coupon.discountType,
          couponDiscountValueSnapshot: coupon.discountValue,
          discountAmount: result.discountAmount,
        },
        manager,
      );
    });

    return this.cartService.getCart(userId);
  }

  /** Idempotent — a Cart without a coupon (or without a cart at all) is a
   * safe no-op, never an error. Never deletes the Coupon row itself. */
  async removeCoupon(userId: string): Promise<CartResponseDto> {
    const order = await this.cartRepository.findActiveCartWithItems(userId);
    if (order?.couponId) {
      await this.cartRepository.runInTransaction(async (manager) => {
        await this.cartCouponRepository.lockOrder(order.id, manager);
        await this.cartCouponRepository.clearCoupon(order.id, manager);
      });
    }
    return this.cartService.getCart(userId);
  }

  private subtotalOf(
    items: { unitPriceAmount: number; quantity: number }[],
  ): number {
    return items.reduce(
      (sum, item) => sum + item.unitPriceAmount * item.quantity,
      0,
    );
  }
}
