import type { EntityManager } from 'typeorm';
import { PaymentTransitionService } from './payment-transition.service';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { CouponsService } from '../coupons/coupons.service';

function buildPayment(overrides: Partial<PaymentEntity> = {}): PaymentEntity {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    order: null as unknown as PaymentEntity['order'],
    provider: PaymentProvider.PAYOS,
    status: PaymentStatus.PENDING,
    amount: 100_000,
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

function buildOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    id: 'order-1',
    userId: 'user-1',
    user: null as unknown as OrderEntity['user'],
    status: OrderStatus.PENDING_PAYMENT,
    subtotalAmount: 100_000,
    totalAmount: 100_000,
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
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PaymentTransitionService', () => {
  let couponsService: jest.Mocked<Pick<CouponsService, 'redeemForOrder'>>;
  let service: PaymentTransitionService;
  let paymentRepo: { save: jest.Mock };
  let orderRepo: { findOne: jest.Mock; save: jest.Mock };
  let historyRepo: { insert: jest.Mock };
  let manager: EntityManager;

  beforeEach(() => {
    paymentRepo = { save: jest.fn((p) => Promise.resolve(p)) };
    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
    };
    historyRepo = { insert: jest.fn() };

    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PaymentEntity) return paymentRepo;
        if (entity === OrderEntity) return orderRepo;
        if (entity === OrderStatusHistoryEntity) return historyRepo;
        throw new Error('unexpected entity');
      }),
    } as unknown as EntityManager;

    couponsService = { redeemForOrder: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentTransitionService(
      couponsService as unknown as CouponsService,
    );
  });

  it('applies PENDING -> PAID, finalizes the order, and redeems the coupon exactly once', async () => {
    const payment = buildPayment({ status: PaymentStatus.PENDING });
    const order = buildOrder({
      status: OrderStatus.PENDING_PAYMENT,
      couponId: 'coupon-1',
      discountAmount: 10_000,
      couponCodeSnapshot: 'SALE10',
    });
    orderRepo.findOne.mockResolvedValue(order);

    const result = await service.applyProviderStatus(
      payment,
      PaymentStatus.PAID,
      manager,
    );

    expect(result.kind).toBe('applied');
    expect(result.payment.status).toBe(PaymentStatus.PAID);
    expect(result.payment.paidAt).toBeInstanceOf(Date);
    expect(orderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.PAID }),
    );
    expect(couponsService.redeemForOrder).toHaveBeenCalledTimes(1);
    expect(couponsService.redeemForOrder).toHaveBeenCalledWith(
      {
        id: order.id,
        couponId: 'coupon-1',
        discountAmount: 10_000,
        couponCodeSnapshot: 'SALE10',
      },
      order.userId,
      manager,
    );
    expect(historyRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.id,
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAID,
      }),
    );
  });

  it('applies PENDING -> CANCELLED without touching the Order', async () => {
    const payment = buildPayment({ status: PaymentStatus.PENDING });

    const result = await service.applyProviderStatus(
      payment,
      PaymentStatus.CANCELLED,
      manager,
    );

    expect(result.kind).toBe('applied');
    expect(result.payment.status).toBe(PaymentStatus.CANCELLED);
    expect(result.payment.cancelledAt).toBeInstanceOf(Date);
    expect(orderRepo.findOne).not.toHaveBeenCalled();
    expect(couponsService.redeemForOrder).not.toHaveBeenCalled();
  });

  it('treats a duplicate PAID -> PAID callback as a no-op', async () => {
    const payment = buildPayment({
      status: PaymentStatus.PAID,
      paidAt: new Date(),
    });

    const result = await service.applyProviderStatus(
      payment,
      PaymentStatus.PAID,
      manager,
    );

    expect(result.kind).toBe('no_op');
    expect(paymentRepo.save).not.toHaveBeenCalled();
    expect(couponsService.redeemForOrder).not.toHaveBeenCalled();
  });

  it('never lets a stale/out-of-order callback overwrite an already-terminal payment', async () => {
    const payment = buildPayment({
      status: PaymentStatus.PAID,
      paidAt: new Date(),
    });

    const result = await service.applyProviderStatus(
      payment,
      PaymentStatus.CANCELLED,
      manager,
    );

    expect(result.kind).toBe('ignored_terminal');
    expect(result.payment.status).toBe(PaymentStatus.PAID);
    expect(paymentRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.FAILED,
  ])(
    'never lets a callback resurrect a %s payment back to PENDING-derived states',
    async (terminalStatus) => {
      const payment = buildPayment({ status: terminalStatus });

      const result = await service.applyProviderStatus(
        payment,
        PaymentStatus.PAID,
        manager,
      );

      expect(result.kind).toBe('ignored_terminal');
      expect(couponsService.redeemForOrder).not.toHaveBeenCalled();
    },
  );

  it('is a no-op if the order was already finalized PAID by another path (e.g. COD)', async () => {
    const payment = buildPayment({ status: PaymentStatus.PENDING });
    const order = buildOrder({ status: OrderStatus.PAID });
    orderRepo.findOne.mockResolvedValue(order);

    await service.applyProviderStatus(payment, PaymentStatus.PAID, manager);

    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(couponsService.redeemForOrder).not.toHaveBeenCalled();
  });
});
