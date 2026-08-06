import { CartPricingService } from './cart-pricing.service';
import { CartCouponRepository } from './cart-coupon.repository';
import { CouponValidationService } from '../coupons/coupon-validation.service';
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
        unitPriceAmount: 100_000,
        quantity: 1,
      } as never,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CartPricingService.revalidateCoupon', () => {
  let cartCouponRepository: jest.Mocked<
    Pick<
      CartCouponRepository,
      'findCoupon' | 'clearCoupon' | 'updateDiscountAmount'
    >
  >;
  let service: CartPricingService;
  const manager = {} as never;

  beforeEach(() => {
    cartCouponRepository = {
      findCoupon: jest.fn(),
      clearCoupon: jest.fn(),
      updateDiscountAmount: jest.fn(),
    };
    service = new CartPricingService(
      cartCouponRepository as unknown as CartCouponRepository,
      new CouponValidationService(),
      { now: () => new Date('2026-06-15') },
    );
  });

  it('is a no-op when the order has no coupon', async () => {
    const result = await service.revalidateCoupon(buildOrder(), manager);
    expect(result).toEqual({
      discountAmount: 0,
      couponRemoved: false,
      removedReason: null,
    });
    expect(cartCouponRepository.findCoupon).not.toHaveBeenCalled();
  });

  it('keeps a still-valid coupon and refreshes discountAmount when subtotal changed', async () => {
    cartCouponRepository.findCoupon.mockResolvedValue(buildCoupon());
    const order = buildOrder({
      couponId: 'coupon-1',
      discountAmount: 5_000, // stale — subtotal grew since it was set
      items: [{ unitPriceAmount: 200_000, quantity: 1 } as never],
    });

    const result = await service.revalidateCoupon(order, manager);

    expect(result.couponRemoved).toBe(false);
    expect(result.discountAmount).toBe(20_000); // 10% of 200,000
    expect(cartCouponRepository.updateDiscountAmount).toHaveBeenCalledWith(
      'order-1',
      20_000,
      manager,
    );
  });

  it('self-removes the coupon when subtotal no longer meets the minimum', async () => {
    cartCouponRepository.findCoupon.mockResolvedValue(
      buildCoupon({ minOrderAmount: 500_000 }),
    );
    const order = buildOrder({
      couponId: 'coupon-1',
      discountAmount: 20_000,
      items: [{ unitPriceAmount: 100_000, quantity: 1 } as never],
    });

    const result = await service.revalidateCoupon(order, manager);

    expect(result.couponRemoved).toBe(true);
    expect(result.discountAmount).toBe(0);
    expect(result.removedReason).not.toBeNull();
    expect(cartCouponRepository.clearCoupon).toHaveBeenCalledWith(
      'order-1',
      manager,
    );
  });

  it('self-removes the coupon when it has expired since being applied', async () => {
    cartCouponRepository.findCoupon.mockResolvedValue(
      buildCoupon({ endsAt: new Date('2026-01-15') }),
    );
    const order = buildOrder({ couponId: 'coupon-1', discountAmount: 10_000 });

    const result = await service.revalidateCoupon(order, manager);

    expect(result.couponRemoved).toBe(true);
    expect(cartCouponRepository.clearCoupon).toHaveBeenCalled();
  });

  it('does not write anything when the persisted discountAmount already matches', async () => {
    cartCouponRepository.findCoupon.mockResolvedValue(buildCoupon());
    const order = buildOrder({ couponId: 'coupon-1', discountAmount: 10_000 });

    await service.revalidateCoupon(order, manager);

    expect(cartCouponRepository.updateDiscountAmount).not.toHaveBeenCalled();
  });
});
