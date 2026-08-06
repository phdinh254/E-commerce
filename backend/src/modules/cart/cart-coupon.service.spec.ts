import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartCouponService } from './cart-coupon.service';
import { CartRepository } from './cart.repository';
import { CartCouponRepository } from './cart-coupon.repository';
import { CartService } from './cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  CouponDiscountType,
  CouponEntity,
} from '../coupons/entities/coupon.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

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

function buildOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    id: 'order-1',
    userId: 'user-1',
    user: null as unknown as OrderEntity['user'],
    status: OrderStatus.CART,
    subtotalAmount: 0,
    totalAmount: 0,
    couponId: null,
    coupon: null,
    couponCodeSnapshot: null,
    couponNameSnapshot: null,
    couponDiscountTypeSnapshot: null,
    couponDiscountValueSnapshot: null,
    discountAmount: 0,
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'p1',
        variantId: null,
        quantity: 1,
        unitPriceAmount: 100_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CartCouponService', () => {
  let cartRepository: jest.Mocked<
    Pick<CartRepository, 'findActiveCartWithItems'>
  > & {
    runInTransaction: jest.Mock;
  };
  let cartCouponRepository: jest.Mocked<
    Pick<CartCouponRepository, 'lockOrder' | 'setCoupon' | 'clearCoupon'>
  >;
  let cartService: jest.Mocked<Pick<CartService, 'getCart'>>;
  let couponsService: jest.Mocked<Pick<CouponsService, 'findByCode'>>;
  let couponValidationService: CouponValidationService;
  let clock: jest.Mocked<Pick<ClockService, 'now'>>;
  let service: CartCouponService;

  beforeEach(() => {
    cartRepository = {
      findActiveCartWithItems: jest.fn(),
      runInTransaction: jest.fn((fn: (manager: unknown) => unknown) => fn({})),
    };
    cartCouponRepository = {
      lockOrder: jest.fn(),
      setCoupon: jest.fn(),
      clearCoupon: jest.fn(),
    };
    cartService = {
      getCart: jest.fn().mockResolvedValue({ cartId: 'order-1' }),
    };
    couponsService = { findByCode: jest.fn() };
    couponValidationService = new CouponValidationService();
    clock = { now: jest.fn().mockReturnValue(new Date('2026-06-15')) };

    service = new CartCouponService(
      cartRepository as unknown as CartRepository,
      cartCouponRepository as unknown as CartCouponRepository,
      cartService as unknown as CartService,
      couponsService as unknown as CouponsService,
      couponValidationService,
      clock,
    );
  });

  describe('previewCoupon', () => {
    it('does not mutate anything and returns a valid preview', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());
      couponsService.findByCode.mockResolvedValue(buildCoupon());

      const result = await service.previewCoupon('user-1', 'welcome10');

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10_000);
      expect(cartCouponRepository.setCoupon).not.toHaveBeenCalled();
      expect(cartCouponRepository.clearCoupon).not.toHaveBeenCalled();
    });

    it('returns COUPON_NOT_FOUND without mutating when the code does not exist', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());
      couponsService.findByCode.mockResolvedValue(null);

      const result = await service.previewCoupon('user-1', 'NOPE');

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('COUPON_NOT_FOUND');
    });

    it('treats no active cart as subtotal 0', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(null);
      couponsService.findByCode.mockResolvedValue(buildCoupon());

      const result = await service.previewCoupon('user-1', 'WELCOME10');

      expect(result.subtotal).toBe(0);
      expect(result.valid).toBe(false); // discount computes to 0 on empty cart
    });
  });

  describe('applyCoupon', () => {
    it('sets the coupon when valid', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());
      couponsService.findByCode.mockResolvedValue(buildCoupon());

      await service.applyCoupon('user-1', 'WELCOME10');

      expect(cartCouponRepository.setCoupon).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({
          couponId: 'coupon-1',
          discountAmount: 10_000,
        }),
        expect.anything(),
      );
      expect(cartService.getCart).toHaveBeenCalledWith('user-1');
    });

    it('throws and never mutates when the new code is invalid — old coupon (if any) survives', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(
        buildOrder({ couponId: 'old-coupon' }),
      );
      couponsService.findByCode.mockResolvedValue(
        buildCoupon({ isActive: false }),
      );

      await expect(
        service.applyCoupon('user-1', 'BADCODE'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cartCouponRepository.setCoupon).not.toHaveBeenCalled();
      expect(cartCouponRepository.clearCoupon).not.toHaveBeenCalled();
    });

    it('throws 404 when there is no active cart', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(null);

      await expect(
        service.applyCoupon('user-1', 'WELCOME10'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 when the code does not exist', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());
      couponsService.findByCode.mockResolvedValue(null);

      await expect(
        service.applyCoupon('user-1', 'NOPE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeCoupon', () => {
    it('clears the coupon when one is applied', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(
        buildOrder({ couponId: 'coupon-1' }),
      );

      await service.removeCoupon('user-1');

      expect(cartCouponRepository.clearCoupon).toHaveBeenCalledWith(
        'order-1',
        expect.anything(),
      );
    });

    it('is a no-op (idempotent, no error) when there is no coupon applied', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());

      await service.removeCoupon('user-1');

      expect(cartCouponRepository.clearCoupon).not.toHaveBeenCalled();
      expect(cartService.getCart).toHaveBeenCalledWith('user-1');
    });

    it('is a no-op (idempotent, no error) when there is no active cart at all', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(null);

      await expect(service.removeCoupon('user-1')).resolves.toBeDefined();
      expect(cartCouponRepository.clearCoupon).not.toHaveBeenCalled();
    });
  });
});
