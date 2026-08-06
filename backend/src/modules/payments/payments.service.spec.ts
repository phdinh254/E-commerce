import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Webhook } from '@payos/node';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentWebhookEventsRepository } from './payment-webhook-events.repository';
import { PaymentTransitionService } from './payment-transition.service';
import type { PaymentGateway } from './payos-gateway.interface';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { ClockService } from '../../common/clock/clock.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

function buildPayment(overrides: Partial<PaymentEntity> = {}): PaymentEntity {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    order: { status: OrderStatus.PENDING_PAYMENT } as PaymentEntity['order'],
    provider: PaymentProvider.PAYOS,
    status: PaymentStatus.PENDING,
    amount: 100_000,
    currency: 'VND',
    providerOrderCode: 100000001,
    providerPaymentLinkId: 'link-1',
    checkoutUrl: 'https://fake-payos.test/checkout/100000001',
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

describe('PaymentsService', () => {
  let paymentsRepository: jest.Mocked<
    Pick<
      PaymentsRepository,
      | 'findLatestByOrderIdForUser'
      | 'findByIdForUpdateOwnedByUser'
      | 'findByProviderOrderCodeForUpdate'
    >
  > & { runInTransaction: jest.Mock };
  let webhookEventsRepository: jest.Mocked<
    Pick<PaymentWebhookEventsRepository, 'insertIfAbsent' | 'markProcessed'>
  >;
  let transitionService: jest.Mocked<
    Pick<PaymentTransitionService, 'applyProviderStatus'>
  >;
  let gateway: jest.Mocked<PaymentGateway>;
  let clock: jest.Mocked<Pick<ClockService, 'now'>>;
  let redis: jest.Mocked<Pick<RedisService, 'acquireLock' | 'releaseLock'>>;
  let fakeManager: EntityManager;
  let service: PaymentsService;

  const NOW = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    fakeManager = {
      getRepository: jest
        .fn()
        .mockReturnValue({ save: jest.fn((p: unknown) => p) }),
    } as unknown as EntityManager;

    paymentsRepository = {
      findLatestByOrderIdForUser: jest.fn(),
      findByIdForUpdateOwnedByUser: jest.fn(),
      findByProviderOrderCodeForUpdate: jest.fn(),
      runInTransaction: jest.fn((fn: (manager: EntityManager) => unknown) =>
        fn(fakeManager),
      ),
    };
    webhookEventsRepository = {
      insertIfAbsent: jest.fn(),
      markProcessed: jest.fn(),
    };
    transitionService = {
      applyProviderStatus: jest.fn().mockResolvedValue({
        kind: 'applied',
        payment: buildPayment({ status: PaymentStatus.PAID }),
      }),
    };
    gateway = {
      createPaymentLink: jest.fn(),
      getPaymentLinkInformation: jest.fn(),
      verifyWebhookData: jest.fn(),
    };
    clock = { now: jest.fn().mockReturnValue(NOW) };
    redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn().mockReturnValue({ syncCooldownSeconds: 10 }),
    };

    service = new PaymentsService(
      paymentsRepository as unknown as PaymentsRepository,
      webhookEventsRepository,
      transitionService as unknown as PaymentTransitionService,
      gateway,
      clock,
      redis as unknown as RedisService,
      configService as never,
    );
  });

  describe('getStatus', () => {
    it('throws NotFoundException when no payment exists for the order/user', async () => {
      paymentsRepository.findLatestByOrderIdForUser.mockResolvedValue(null);

      await expect(service.getStatus('order-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps a PENDING PayOS payment to a response that exposes checkoutUrl', async () => {
      paymentsRepository.findLatestByOrderIdForUser.mockResolvedValue(
        buildPayment(),
      );

      const result = await service.getStatus('order-1', 'user-1');

      expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(result.isTerminal).toBe(false);
      expect(result.checkoutUrl).toBe(
        'https://fake-payos.test/checkout/100000001',
      );
    });

    it('never exposes checkoutUrl once the payment is PAID', async () => {
      paymentsRepository.findLatestByOrderIdForUser.mockResolvedValue(
        buildPayment({ status: PaymentStatus.PAID, paidAt: NOW }),
      );

      const result = await service.getStatus('order-1', 'user-1');

      expect(result.isTerminal).toBe(true);
      expect(result.checkoutUrl).toBeNull();
    });
  });

  describe('syncStatus', () => {
    it('throws NotFoundException when the payment does not belong to the user', async () => {
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(null);

      await expect(service.syncStatus('payment-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects syncing a COD payment', async () => {
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        buildPayment({ provider: PaymentProvider.COD }),
      );

      await expect(service.syncStatus('payment-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('is a no-op read for an already-terminal payment (never calls the gateway)', async () => {
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        buildPayment({ status: PaymentStatus.PAID, paidAt: NOW }),
      );

      const result = await service.syncStatus('payment-1', 'user-1');

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(gateway.getPaymentLinkInformation).not.toHaveBeenCalled();
    });

    it('skips the gateway call when the lock could not be acquired (concurrent sync in flight)', async () => {
      redis.acquireLock.mockResolvedValue(false);
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        buildPayment(),
      );

      const result = await service.syncStatus('payment-1', 'user-1');

      expect(gateway.getPaymentLinkInformation).not.toHaveBeenCalled();
      expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(redis.releaseLock).not.toHaveBeenCalled();
    });

    it('skips the gateway call within the cooldown window', async () => {
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        buildPayment({ lastSyncedAt: new Date(NOW.getTime() - 5_000) }),
      );

      await service.syncStatus('payment-1', 'user-1');

      expect(gateway.getPaymentLinkInformation).not.toHaveBeenCalled();
    });

    it('calls the gateway, then delegates the transition to PaymentTransitionService', async () => {
      const payment = buildPayment();
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        payment,
      );
      gateway.getPaymentLinkInformation.mockResolvedValue({
        paymentLinkId: 'link-1',
        orderCode: 100000001,
        amount: 100_000,
        status: 'PAID',
      });

      const result = await service.syncStatus('payment-1', 'user-1');

      expect(gateway.getPaymentLinkInformation).toHaveBeenCalledWith(100000001);
      expect(transitionService.applyProviderStatus).toHaveBeenCalledWith(
        payment,
        PaymentStatus.PAID,
        fakeManager,
      );
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(redis.releaseLock).toHaveBeenCalledWith('payment-sync:payment-1');
    });

    it('does not transition on an amount mismatch from the gateway', async () => {
      const payment = buildPayment();
      paymentsRepository.findByIdForUpdateOwnedByUser.mockResolvedValue(
        payment,
      );
      gateway.getPaymentLinkInformation.mockResolvedValue({
        paymentLinkId: 'link-1',
        orderCode: 100000001,
        amount: 999_999,
        status: 'PAID',
      });

      await service.syncStatus('payment-1', 'user-1');

      expect(transitionService.applyProviderStatus).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    const rawWebhook: Webhook = {
      code: '00',
      desc: 'success',
      success: true,
      signature: 'sig',
      data: {
        orderCode: 100000001,
        amount: 100_000,
        description: 'test',
        accountNumber: '0123456789',
        reference: 'ref-1',
        transactionDateTime: new Date().toISOString(),
        currency: 'VND',
        paymentLinkId: 'link-1',
        code: '00',
        desc: 'success',
      },
    };

    it('verifies the signature before doing anything else', async () => {
      gateway.verifyWebhookData.mockRejectedValue(new Error('bad signature'));

      await expect(service.processWebhook(rawWebhook)).rejects.toThrow(
        'bad signature',
      );
      expect(paymentsRepository.runInTransaction).not.toHaveBeenCalled();
    });

    it('ignores a duplicate webhook without touching Payment/Coupon state', async () => {
      gateway.verifyWebhookData.mockResolvedValue(rawWebhook.data);
      webhookEventsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'already-processed',
        event: { id: 'event-1' } as never,
      });

      await service.processWebhook(rawWebhook);

      expect(
        paymentsRepository.findByProviderOrderCodeForUpdate,
      ).not.toHaveBeenCalled();
      expect(transitionService.applyProviderStatus).not.toHaveBeenCalled();
    });

    it('marks the event ERROR when no payment matches the orderCode', async () => {
      gateway.verifyWebhookData.mockResolvedValue(rawWebhook.data);
      webhookEventsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        event: { id: 'event-1' } as never,
      });
      paymentsRepository.findByProviderOrderCodeForUpdate.mockResolvedValue(
        null,
      );

      await service.processWebhook(rawWebhook);

      expect(webhookEventsRepository.markProcessed).toHaveBeenCalledWith(
        'event-1',
        'ERROR',
        fakeManager,
      );
      expect(transitionService.applyProviderStatus).not.toHaveBeenCalled();
    });

    it('marks the event ERROR and never transitions on an amount mismatch', async () => {
      gateway.verifyWebhookData.mockResolvedValue(rawWebhook.data);
      webhookEventsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        event: { id: 'event-1' } as never,
      });
      paymentsRepository.findByProviderOrderCodeForUpdate.mockResolvedValue(
        buildPayment({ amount: 1 }),
      );

      await service.processWebhook(rawWebhook);

      expect(webhookEventsRepository.markProcessed).toHaveBeenCalledWith(
        'event-1',
        'ERROR',
        fakeManager,
      );
      expect(transitionService.applyProviderStatus).not.toHaveBeenCalled();
    });

    it('transitions to PAID and marks the event SUCCESS on a verified, matching webhook', async () => {
      gateway.verifyWebhookData.mockResolvedValue(rawWebhook.data);
      webhookEventsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        event: { id: 'event-1' } as never,
      });
      const payment = buildPayment();
      paymentsRepository.findByProviderOrderCodeForUpdate.mockResolvedValue(
        payment,
      );

      await service.processWebhook(rawWebhook);

      expect(transitionService.applyProviderStatus).toHaveBeenCalledWith(
        payment,
        PaymentStatus.PAID,
        fakeManager,
      );
      expect(webhookEventsRepository.markProcessed).toHaveBeenCalledWith(
        'event-1',
        'SUCCESS',
        fakeManager,
      );
    });
  });
});
