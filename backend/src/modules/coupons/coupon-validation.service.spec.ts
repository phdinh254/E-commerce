import { CouponValidationService } from './coupon-validation.service';
import { CouponDiscountType, CouponEntity } from './entities/coupon.entity';

function buildCoupon(overrides: Partial<CouponEntity> = {}): CouponEntity {
  return {
    id: 'coupon-1',
    code: 'WELCOME10',
    name: 'Chào mừng',
    description: null,
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2026-12-31T00:00:00.000Z'),
    usageLimit: null,
    perUserLimit: null,
    usedCount: 0,
    isActive: true,
    applicableCategoryId: null,
    applicableCategory: null,
    applicableProductId: null,
    applicableProduct: null,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

const NOW = new Date('2026-06-15T00:00:00.000Z');

describe('CouponValidationService', () => {
  const service = new CouponValidationService();

  it('rejects an inactive coupon', () => {
    const result = service.validate(
      buildCoupon({ isActive: false }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('COUPON_INACTIVE');
  });

  it('rejects strictly before startsAt', () => {
    const result = service.validate(
      buildCoupon({ startsAt: new Date('2026-06-15T00:00:00.001Z') }),
      100_000,
      NOW,
    );
    expect(result.reasonCode).toBe('COUPON_NOT_STARTED');
  });

  it('accepts exactly at startsAt (inclusive)', () => {
    const result = service.validate(
      buildCoupon({ startsAt: NOW }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
  });

  it('accepts one millisecond before endsAt', () => {
    const result = service.validate(
      buildCoupon({ endsAt: new Date(NOW.getTime() + 1) }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects exactly at endsAt (exclusive)', () => {
    const result = service.validate(buildCoupon({ endsAt: NOW }), 100_000, NOW);
    expect(result.reasonCode).toBe('COUPON_EXPIRED');
  });

  it('rejects after endsAt', () => {
    const result = service.validate(
      buildCoupon({ endsAt: new Date(NOW.getTime() - 1) }),
      100_000,
      NOW,
    );
    expect(result.reasonCode).toBe('COUPON_EXPIRED');
  });

  it('allows unlimited usage when usageLimit is null', () => {
    const result = service.validate(
      buildCoupon({ usageLimit: null, usedCount: 999_999 }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
  });

  it('accepts when usage remains under the limit', () => {
    const result = service.validate(
      buildCoupon({ usageLimit: 10, usedCount: 9 }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects once usage has reached the limit', () => {
    const result = service.validate(
      buildCoupon({ usageLimit: 10, usedCount: 10 }),
      100_000,
      NOW,
    );
    expect(result.reasonCode).toBe('COUPON_USAGE_LIMIT_REACHED');
  });

  it('rejects when subtotal is below minOrderAmount', () => {
    const result = service.validate(
      buildCoupon({ minOrderAmount: 200_000 }),
      100_000,
      NOW,
    );
    expect(result.reasonCode).toBe('COUPON_MINIMUM_NOT_MET');
  });

  it('accepts when subtotal exactly meets minOrderAmount', () => {
    const result = service.validate(
      buildCoupon({ minOrderAmount: 100_000 }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects with COUPON_INVALID_VALUE when the computed discount is 0 (empty cart)', () => {
    const result = service.validate(buildCoupon(), 0, NOW);
    expect(result.reasonCode).toBe('COUPON_INVALID_VALUE');
    expect(result.discountAmount).toBe(0);
  });

  it('computes discountAmount and total for a valid FIXED coupon', () => {
    const result = service.validate(
      buildCoupon({
        discountType: CouponDiscountType.FIXED,
        discountValue: 30_000,
      }),
      100_000,
      NOW,
    );
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(30_000);
    expect(result.total).toBe(70_000);
  });

  it('applies maxDiscountAmount cap for PERCENTAGE', () => {
    const result = service.validate(
      buildCoupon({ discountValue: 50, maxDiscountAmount: 20_000 }),
      1_000_000,
      NOW,
    );
    expect(result.discountAmount).toBe(20_000);
  });

  it('never returns a total below zero or above subtotal', () => {
    const result = service.validate(
      buildCoupon({
        discountType: CouponDiscountType.FIXED,
        discountValue: 999_999_999,
      }),
      100_000,
      NOW,
    );
    expect(result.discountAmount).toBeLessThanOrEqual(100_000);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
