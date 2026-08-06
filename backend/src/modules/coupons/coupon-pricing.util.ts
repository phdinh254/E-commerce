import { CouponDiscountType } from './entities/coupon.entity';

/**
 * The single formula every caller (preview, apply, cart mutation
 * revalidation, confirmation) must use — never re-derive this elsewhere.
 * Integer VND math only, no floating point.
 *
 * PERCENTAGE: discountValue is a whole percentage point count (1-100, DB
 * CHECK-enforced) — rawDiscount = floor(subtotal * discountValue / 100).
 * FIXED: discountValue is already a VND integer amount — rawDiscount = discountValue.
 * Then discount = min(rawDiscount, maxDiscountAmount ?? +Infinity, subtotal),
 * so total = subtotal - discount is never negative and discount never
 * exceeds subtotal.
 */
export function computeDiscountAmount(params: {
  discountType: CouponDiscountType;
  discountValue: number;
  subtotal: number;
  maxDiscountAmount: number | null;
}): number {
  const { discountType, discountValue, subtotal, maxDiscountAmount } = params;

  if (subtotal <= 0) return 0;

  const rawDiscount =
    discountType === CouponDiscountType.PERCENTAGE
      ? Math.floor((subtotal * discountValue) / 100)
      : discountValue;

  let discount = rawDiscount;
  if (maxDiscountAmount !== null) {
    discount = Math.min(discount, maxDiscountAmount);
  }
  discount = Math.min(discount, subtotal);
  return Math.max(0, discount);
}
