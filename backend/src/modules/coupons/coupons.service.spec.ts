import { ConflictException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';
import { CouponRedemptionsRepository } from './coupon-redemptions.repository';
import { ClockService } from '../../common/clock/clock.service';
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
    startsAt: new Date('2026-01-01'),
    endsAt: new Date('2026-12-31'),
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

describe('CouponsService', () => {
  let couponsRepository: jest.Mocked<
    Pick<
      CouponsRepository,
      | 'findByCodeUpper'
      | 'findFeatured'
      | 'lockForUpdate'
      | 'incrementUsedCount'
    >
  >;
  let redemptionsRepository: jest.Mocked<
    Pick<CouponRedemptionsRepository, 'insertIfAbsent'>
  >;
  let clock: jest.Mocked<Pick<ClockService, 'now'>>;
  let service: CouponsService;
  const fakeManager = {} as never;

  beforeEach(() => {
    couponsRepository = {
      findByCodeUpper: jest.fn(),
      findFeatured: jest.fn(),
      lockForUpdate: jest.fn(),
      incrementUsedCount: jest.fn(),
    };
    redemptionsRepository = { insertIfAbsent: jest.fn() };
    clock = { now: jest.fn().mockReturnValue(new Date('2026-06-15')) };

    service = new CouponsService(
      couponsRepository as unknown as CouponsRepository,
      redemptionsRepository,
      clock,
    );
  });

  describe('redeemForOrder', () => {
    it('no-ops when the order has no coupon', async () => {
      await service.redeemForOrder(
        {
          id: 'order-1',
          couponId: null,
          discountAmount: 0,
          couponCodeSnapshot: null,
        },
        'user-1',
        fakeManager,
      );
      expect(couponsRepository.lockForUpdate).not.toHaveBeenCalled();
    });

    it('inserts a redemption and increments usedCount on first confirmation', async () => {
      couponsRepository.lockForUpdate.mockResolvedValue(
        buildCoupon({ usageLimit: 10, usedCount: 3 }),
      );
      redemptionsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        redemption: {} as never,
      });

      await service.redeemForOrder(
        {
          id: 'order-1',
          couponId: 'coupon-1',
          discountAmount: 10_000,
          couponCodeSnapshot: 'WELCOME10',
        },
        'user-1',
        fakeManager,
      );

      expect(couponsRepository.incrementUsedCount).toHaveBeenCalledWith(
        'coupon-1',
        fakeManager,
      );
    });

    it('does NOT increment usedCount again on a retried confirmation (already redeemed)', async () => {
      couponsRepository.lockForUpdate.mockResolvedValue(
        buildCoupon({ usageLimit: 10, usedCount: 4 }),
      );
      redemptionsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'already-redeemed',
        redemption: {} as never,
      });

      await service.redeemForOrder(
        {
          id: 'order-1',
          couponId: 'coupon-1',
          discountAmount: 10_000,
          couponCodeSnapshot: 'WELCOME10',
        },
        'user-1',
        fakeManager,
      );

      expect(couponsRepository.incrementUsedCount).not.toHaveBeenCalled();
    });

    it('rejects (throws) when usageLimit has already been reached — the last-slot race', async () => {
      couponsRepository.lockForUpdate.mockResolvedValue(
        buildCoupon({ usageLimit: 5, usedCount: 5 }),
      );

      await expect(
        service.redeemForOrder(
          {
            id: 'order-1',
            couponId: 'coupon-1',
            discountAmount: 10_000,
            couponCodeSnapshot: 'WELCOME10',
          },
          'user-1',
          fakeManager,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(redemptionsRepository.insertIfAbsent).not.toHaveBeenCalled();
    });
  });

  describe('getFeatured', () => {
    it('maps entities to the marketing-safe projection', async () => {
      couponsRepository.findFeatured.mockResolvedValue([buildCoupon()]);

      const result = await service.getFeatured(6);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 'WELCOME10',
        name: 'Chào mừng',
        description: null,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        startsAt: buildCoupon().startsAt,
        endsAt: buildCoupon().endsAt,
      });
      expect(result[0]).not.toHaveProperty('usedCount');
      expect(result[0]).not.toHaveProperty('deletedAt');
    });
  });
});
