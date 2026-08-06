import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { CheckoutService } from './checkout.service';
import { CartRepository } from '../cart/cart.repository';
import { CartPricingService } from '../cart/cart-pricing.service';
import { IdempotencyRepository } from '../cart/idempotency.repository';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { PaymentsRepository } from '../payments/payments.repository';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import type { PaymentGateway } from '../payments/payos-gateway.interface';
import { CouponsService } from '../coupons/coupons.service';
import { ClockService } from '../../common/clock/clock.service';
import { CreateCheckoutDto } from '../payments/dto/create-checkout.dto';

function buildDto(
  overrides: Partial<CreateCheckoutDto> = {},
): CreateCheckoutDto {
  return {
    shippingRecipientName: 'Nguyen Van A',
    shippingPhoneNumber: '0912345678',
    shippingProvince: 'Ha Noi',
    shippingDistrict: 'Cau Giay',
    shippingWard: 'Dich Vong',
    shippingStreetAddress: '123 Xuan Thuy',
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
    shippingRecipientName: null,
    shippingPhoneNumber: null,
    shippingProvince: null,
    shippingDistrict: null,
    shippingWard: null,
    shippingStreetAddress: null,
    shippingNote: null,
    placedAt: null,
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        order: null as unknown as OrderEntity,
        productId: 'prod-1',
        product: { name: 'Ao thun', isActive: true, deletedAt: null } as never,
        variantId: null,
        variant: null,
        quantity: 2,
        unitPriceAmount: 100_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as OrderEntity['items'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPayment(overrides: Partial<PaymentEntity> = {}): PaymentEntity {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    order: null as unknown as PaymentEntity['order'],
    provider: PaymentProvider.PAYOS,
    status: PaymentStatus.PENDING,
    amount: 200_000,
    currency: 'VND',
    providerOrderCode: 100000001,
    providerPaymentLinkId: null,
    checkoutUrl: null,
    description: null,
    attemptNumber: 1,
    paidAt: null,
    cancelledAt: null,
    expiredAt: null,
    failedAt: null,
    failureReason: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CheckoutService', () => {
  let cartRepository: jest.Mocked<
    Pick<CartRepository, 'lockActiveCartWithItemsForUser'>
  > & { runInTransaction: jest.Mock };
  let cartPricingService: jest.Mocked<
    Pick<CartPricingService, 'revalidateCoupon'>
  >;
  let idempotencyRepository: jest.Mocked<
    Pick<IdempotencyRepository, 'insertPlaceholder' | 'recordResponse'>
  >;
  let paymentsRepository: jest.Mocked<
    Pick<
      PaymentsRepository,
      | 'create'
      | 'save'
      | 'nextOrderCode'
      | 'findById'
      | 'findByIdForUpdate'
      | 'findOrderItemsForPayment'
    >
  > & { runInTransaction: jest.Mock };
  let couponsService: jest.Mocked<Pick<CouponsService, 'redeemForOrder'>>;
  let clock: jest.Mocked<Pick<ClockService, 'now'>>;
  let gateway: jest.Mocked<PaymentGateway>;
  let fakeManager: EntityManager;
  let service: CheckoutService;

  const NOW = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    fakeManager = {
      getRepository: jest.fn().mockReturnValue({
        save: jest.fn((entity) => Promise.resolve(entity)),
        insert: jest.fn().mockResolvedValue(undefined),
      }),
    } as unknown as EntityManager;

    cartRepository = {
      lockActiveCartWithItemsForUser: jest.fn(),
      runInTransaction: jest.fn((fn: (manager: EntityManager) => unknown) =>
        fn(fakeManager),
      ),
    };
    cartPricingService = {
      revalidateCoupon: jest.fn().mockResolvedValue({
        discountAmount: 0,
        couponRemoved: false,
        removedReason: null,
      }),
    };
    idempotencyRepository = {
      insertPlaceholder: jest.fn(),
      recordResponse: jest.fn().mockResolvedValue(undefined),
    };
    paymentsRepository = {
      create: jest.fn((data) => data as PaymentEntity),
      save: jest.fn((payment) =>
        Promise.resolve({ ...payment, id: payment.id ?? 'payment-1' }),
      ),
      nextOrderCode: jest.fn().mockResolvedValue(100000001),
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findOrderItemsForPayment: jest.fn().mockResolvedValue([]),
      runInTransaction: jest.fn((fn: (manager: EntityManager) => unknown) =>
        fn(fakeManager),
      ),
    };
    couponsService = { redeemForOrder: jest.fn().mockResolvedValue(undefined) };
    clock = { now: jest.fn().mockReturnValue(NOW) };
    gateway = {
      createPaymentLink: jest.fn(),
      getPaymentLinkInformation: jest.fn(),
      verifyWebhookData: jest.fn(),
    };

    service = new CheckoutService(
      cartRepository as unknown as CartRepository,
      cartPricingService as unknown as CartPricingService,
      idempotencyRepository as unknown as IdempotencyRepository,
      paymentsRepository as unknown as PaymentsRepository,
      couponsService as unknown as CouponsService,
      clock,
      gateway,
    );
  });

  describe('placeCodOrder', () => {
    it('confirms the order as PAID synchronously and redeems the coupon once', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      const order = buildOrder();
      cartRepository.lockActiveCartWithItemsForUser.mockResolvedValue(order);

      const result = await service.placeCodOrder('user-1', buildDto(), 'key-1');

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.totalAmount).toBe(200_000);
      expect(result.paymentMethod).toBe(PaymentProvider.COD);
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.checkoutUrl).toBeNull();
      expect(couponsService.redeemForOrder).toHaveBeenCalledTimes(1);
      expect(gateway.createPaymentLink).not.toHaveBeenCalled();
    });

    it('rejects checkout when the cart is empty', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      cartRepository.lockActiveCartWithItemsForUser.mockResolvedValue(null);

      await expect(
        service.placeCodOrder('user-1', buildDto(), 'key-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects checkout when a cart item is no longer available', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      const order = buildOrder({
        items: [
          {
            ...buildOrder().items[0],
            product: { name: 'x', isActive: false, deletedAt: null } as never,
          },
        ] as OrderEntity['items'],
      });
      cartRepository.lockActiveCartWithItemsForUser.mockResolvedValue(order);

      await expect(
        service.placeCodOrder('user-1', buildDto(), 'key-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('replays the stored response for a repeated Idempotency-Key with the same payload', async () => {
      const dto = buildDto();
      const storedResponse = {
        orderId: 'order-1',
        paymentId: 'payment-1',
        paymentMethod: PaymentProvider.COD,
        paymentStatus: PaymentStatus.PAID,
        checkoutUrl: null,
      };
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: {
          responseStatus: 200,
          requestHash: hashOf(dto),
          responseBody: storedResponse,
        } as never,
      });

      const result = await service.placeCodOrder('user-1', dto, 'key-1');

      expect(result).toEqual(storedResponse);
      expect(
        cartRepository.lockActiveCartWithItemsForUser,
      ).not.toHaveBeenCalled();
    });

    it('rejects a reused Idempotency-Key sent with a different payload', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: {
          responseStatus: 200,
          requestHash: 'some-other-hash',
          responseBody: {},
        } as never,
      });

      await expect(
        service.placeCodOrder('user-1', buildDto(), 'key-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('placePayOsOrder', () => {
    it('commits the PENDING_PAYMENT order/payment, then creates the payment link and persists checkoutUrl', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      const order = buildOrder();
      cartRepository.lockActiveCartWithItemsForUser.mockResolvedValue(order);
      gateway.createPaymentLink.mockResolvedValue({
        checkoutUrl: 'https://pay.payos.vn/web/abc',
        paymentLinkId: 'link-abc',
        status: 'PENDING',
      });
      paymentsRepository.findById.mockResolvedValue(
        buildPayment({ status: PaymentStatus.PENDING }),
      );
      paymentsRepository.findByIdForUpdate.mockResolvedValue(
        buildPayment({ status: PaymentStatus.PENDING }),
      );

      const result = await service.placePayOsOrder(
        'user-1',
        buildDto(),
        'key-1',
      );

      expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
      expect(couponsService.redeemForOrder).not.toHaveBeenCalled();
      expect(gateway.createPaymentLink).toHaveBeenCalledWith(
        expect.objectContaining({ orderCode: 100000001, amount: 200_000 }),
      );
      expect(result.paymentMethod).toBe(PaymentProvider.PAYOS);
      expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('marks the payment FAILED and propagates the error when PayOS is unreachable', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      cartRepository.lockActiveCartWithItemsForUser.mockResolvedValue(
        buildOrder(),
      );
      gateway.createPaymentLink.mockRejectedValue(
        new Error('PayOS unreachable'),
      );
      paymentsRepository.findById.mockResolvedValue(
        buildPayment({ status: PaymentStatus.PENDING }),
      );
      const lockedPayment = buildPayment({ status: PaymentStatus.PENDING });
      paymentsRepository.findByIdForUpdate.mockResolvedValue(lockedPayment);

      await expect(
        service.placePayOsOrder('user-1', buildDto(), 'key-1'),
      ).rejects.toThrow('PayOS unreachable');

      expect(lockedPayment.status).toBe(PaymentStatus.FAILED);
      expect(lockedPayment.failureReason).toBe('PayOS unreachable');
    });

    it('on Idempotency-Key replay, re-reads the current payment instead of calling PayOS again', async () => {
      const dto = buildDto();
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: {
          responseStatus: 200,
          requestHash: hashOf(dto),
          responseBody: { orderId: 'order-1', paymentId: 'payment-1' },
        } as never,
      });
      paymentsRepository.findById.mockResolvedValue(
        buildPayment({ checkoutUrl: 'https://pay.payos.vn/web/abc' }),
      );

      const result = await service.placePayOsOrder('user-1', dto, 'key-1');

      expect(gateway.createPaymentLink).not.toHaveBeenCalled();
      expect(result.checkoutUrl).toBe('https://pay.payos.vn/web/abc');
    });
  });
});

function hashOf(dto: CreateCheckoutDto): string {
  const normalized = JSON.stringify({
    shippingRecipientName: dto.shippingRecipientName,
    shippingPhoneNumber: dto.shippingPhoneNumber,
    shippingProvince: dto.shippingProvince,
    shippingDistrict: dto.shippingDistrict,
    shippingWard: dto.shippingWard,
    shippingStreetAddress: dto.shippingStreetAddress,
    shippingNote: dto.shippingNote ?? null,
  });
  return createHash('sha256').update(normalized).digest('hex');
}
