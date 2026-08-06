import { Injectable } from '@nestjs/common';
import { CouponEntity } from './entities/coupon.entity';
import { computeDiscountAmount } from './coupon-pricing.util';
import { CouponReasonCode } from './dto/coupon-preview-response.dto';

export interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  total: number;
  reasonCode: CouponReasonCode | null;
  message: string;
}

const MESSAGES: Record<CouponReasonCode, string> = {
  COUPON_NOT_FOUND: 'Mã giảm giá không hợp lệ',
  COUPON_INACTIVE: 'Mã giảm giá không hợp lệ',
  COUPON_NOT_STARTED: 'Mã giảm giá chưa bắt đầu áp dụng',
  COUPON_EXPIRED: 'Mã giảm giá đã hết hạn',
  COUPON_USAGE_LIMIT_REACHED: 'Mã giảm giá đã hết lượt sử dụng',
  COUPON_MINIMUM_NOT_MET: 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã',
  COUPON_INVALID_VALUE: 'Mã giảm giá không áp dụng được cho đơn hàng này',
};

/**
 * Pure(ish) validation against a caller-resolved CouponEntity, subtotal,
 * and clock — never queries the DB itself. COUPON_NOT_FOUND is produced by
 * the caller (a failed lookup), not here: soft-deleted rows are already
 * excluded by TypeORM's default @DeleteDateColumn filtering, so a Coupon
 * reaching this method is guaranteed to exist and not be soft-deleted.
 *
 * startsAt is inclusive, endsAt is exclusive — `now < startsAt` fails,
 * `now >= endsAt` fails, matching the DB's own timestamptz semantics.
 */
@Injectable()
export class CouponValidationService {
  validate(
    coupon: CouponEntity,
    subtotal: number,
    now: Date,
  ): CouponValidationResult {
    const reject = (reasonCode: CouponReasonCode): CouponValidationResult => ({
      valid: false,
      discountAmount: 0,
      total: subtotal,
      reasonCode,
      message: MESSAGES[reasonCode],
    });

    if (!coupon.isActive) {
      return reject('COUPON_INACTIVE');
    }
    if (now < coupon.startsAt) {
      return reject('COUPON_NOT_STARTED');
    }
    if (now >= coupon.endsAt) {
      return reject('COUPON_EXPIRED');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return reject('COUPON_USAGE_LIMIT_REACHED');
    }
    if (subtotal < coupon.minOrderAmount) {
      return reject('COUPON_MINIMUM_NOT_MET');
    }

    const discountAmount = computeDiscountAmount({
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      subtotal,
      maxDiscountAmount: coupon.maxDiscountAmount,
    });

    if (discountAmount <= 0) {
      return reject('COUPON_INVALID_VALUE');
    }

    return {
      valid: true,
      discountAmount,
      total: subtotal - discountAmount,
      reasonCode: null,
      message: 'Mã giảm giá hợp lệ',
    };
  }
}
