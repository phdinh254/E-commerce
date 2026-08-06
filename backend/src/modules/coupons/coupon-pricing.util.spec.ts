import { computeDiscountAmount } from './coupon-pricing.util';
import { CouponDiscountType } from './entities/coupon.entity';

describe('computeDiscountAmount', () => {
  it('computes PERCENTAGE via floor(subtotal * value / 100)', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
      subtotal: 500_000,
      maxDiscountAmount: null,
    });
    expect(discount).toBe(50_000);
  });

  it('rounds PERCENTAGE down (floor), never up', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 33,
      subtotal: 10,
      maxDiscountAmount: null,
    });
    // 10 * 33 / 100 = 3.3 -> floor = 3
    expect(discount).toBe(3);
  });

  it('uses FIXED discountValue directly as the VND amount', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.FIXED,
      discountValue: 30_000,
      subtotal: 500_000,
      maxDiscountAmount: null,
    });
    expect(discount).toBe(30_000);
  });

  it('caps at maxDiscountAmount when the raw discount exceeds it', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 50,
      subtotal: 1_000_000,
      maxDiscountAmount: 100_000,
    });
    // raw = 500,000, capped to 100,000
    expect(discount).toBe(100_000);
  });

  it('never exceeds subtotal even without a maxDiscountAmount cap', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.FIXED,
      discountValue: 999_999,
      subtotal: 50_000,
      maxDiscountAmount: null,
    });
    expect(discount).toBe(50_000);
  });

  it('returns 0 for a zero or negative subtotal (empty cart)', () => {
    expect(
      computeDiscountAmount({
        discountType: CouponDiscountType.FIXED,
        discountValue: 10_000,
        subtotal: 0,
        maxDiscountAmount: null,
      }),
    ).toBe(0);
  });

  it('never returns a negative discount', () => {
    const discount = computeDiscountAmount({
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 1,
      subtotal: 1,
      maxDiscountAmount: null,
    });
    expect(discount).toBeGreaterThanOrEqual(0);
  });
});
