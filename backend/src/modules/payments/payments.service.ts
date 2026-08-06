import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { Webhook } from '@payos/node';
import { PaymentsRepository } from './payments.repository';
import { PaymentWebhookEventsRepository } from './payment-webhook-events.repository';
import { PaymentTransitionService } from './payment-transition.service';
import { PAYMENT_GATEWAY } from './payos-gateway.interface';
import type { PaymentGateway } from './payos-gateway.interface';
import {
  mapPaymentLinkStatus,
  mapWebhookDataStatus,
} from './payos-status.mapper';
import {
  PaymentStatus,
  TERMINAL_PAYMENT_STATUSES,
} from './enums/payment-status.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentStatusResponseDto } from './dto/payment-status-response.dto';
import { ClockService } from '../../common/clock/clock.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import type { PayOsConfig } from '../../config/configuration';

const SYNC_LOCK_TTL_MS = 10_000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly payosConfig: PayOsConfig;

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly webhookEventsRepository: PaymentWebhookEventsRepository,
    private readonly transitionService: PaymentTransitionService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly clock: ClockService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.payosConfig = configService.get<PayOsConfig>('payos') as PayOsConfig;
  }

  async getStatus(
    orderId: string,
    userId: string,
  ): Promise<PaymentStatusResponseDto> {
    const payment = await this.paymentsRepository.findLatestByOrderIdForUser(
      orderId,
      userId,
    );
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy thanh toán cho đơn hàng này',
      });
    }
    return this.toStatusResponse(payment);
  }

  async syncStatus(
    paymentId: string,
    userId: string,
  ): Promise<PaymentStatusResponseDto> {
    const lockKey = `payment-sync:${paymentId}`;
    const acquired = await this.redis.acquireLock(lockKey, SYNC_LOCK_TTL_MS);

    try {
      return await this.paymentsRepository.runInTransaction(async (manager) => {
        const payment =
          await this.paymentsRepository.findByIdForUpdateOwnedByUser(
            paymentId,
            userId,
            manager,
          );
        if (!payment) {
          throw new NotFoundException({
            code: 'PAYMENT_NOT_FOUND',
            message: 'Không tìm thấy thanh toán',
          });
        }
        if (payment.provider !== PaymentProvider.PAYOS) {
          throw new BadRequestException({
            code: 'PAYMENT_NOT_SYNCABLE',
            message: 'Chỉ thanh toán PayOS mới cần đồng bộ',
          });
        }
        if (TERMINAL_PAYMENT_STATUSES.has(payment.status)) {
          // Already settled — nothing to sync, return as-is (idempotent).
          return this.toStatusResponse(payment);
        }
        if (!acquired) {
          // Another sync is in flight for this payment — don't call PayOS
          // twice concurrently, just report current (still-PENDING) state.
          return this.toStatusResponse(payment);
        }
        if (this.withinCooldown(payment)) {
          return this.toStatusResponse(payment);
        }

        const info = await this.gateway.getPaymentLinkInformation(
          payment.providerOrderCode as number,
        );
        payment.lastSyncedAt = this.clock.now();
        await manager.getRepository(PaymentEntity).save(payment);

        if (info.amount !== payment.amount) {
          this.logger.warn(
            `Sync amount mismatch for payment=${payment.id}: expected=${payment.amount} got=${info.amount}`,
          );
          return this.toStatusResponse(payment);
        }

        const targetStatus = mapPaymentLinkStatus(info.status);
        const result = await this.transitionService.applyProviderStatus(
          payment,
          targetStatus,
          manager,
        );
        return this.toStatusResponse(result.payment);
      });
    } finally {
      if (acquired) await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * Signature MUST already be verified by the time `verifiedData` exists —
   * this method never receives raw unverified input. Always resolves (never
   * throws) once verification succeeded, so PayOS doesn't retry-storm a
   * webhook whose failure was on our side after acknowledging receipt is
   * unsafe; unexpected errors still propagate to produce a 5xx so PayOS
   * retries as designed.
   */
  async processWebhook(webhook: Webhook): Promise<void> {
    const verifiedData = await this.gateway.verifyWebhookData(webhook);
    const externalEventKey = createHash('sha256')
      .update(JSON.stringify(verifiedData))
      .digest('hex');

    await this.paymentsRepository.runInTransaction(async (manager) => {
      const insertOutcome = await this.webhookEventsRepository.insertIfAbsent(
        {
          provider: PaymentProvider.PAYOS,
          externalEventKey,
          providerOrderCode: verifiedData.orderCode,
          eventStatus: verifiedData.code,
        },
        manager,
      );

      if (insertOutcome.kind === 'already-processed') {
        this.logger.log(
          `Duplicate PayOS webhook ignored: orderCode=${verifiedData.orderCode}`,
        );
        return;
      }

      const payment =
        await this.paymentsRepository.findByProviderOrderCodeForUpdate(
          PaymentProvider.PAYOS,
          verifiedData.orderCode,
          manager,
        );
      if (!payment) {
        this.logger.error(
          `PayOS webhook for unknown orderCode=${verifiedData.orderCode}`,
        );
        await this.webhookEventsRepository.markProcessed(
          insertOutcome.event.id,
          'ERROR',
          manager,
        );
        return;
      }

      if (verifiedData.amount !== payment.amount) {
        this.logger.error(
          `PayOS webhook amount mismatch for payment=${payment.id}: expected=${payment.amount} got=${verifiedData.amount}`,
        );
        await this.webhookEventsRepository.markProcessed(
          insertOutcome.event.id,
          'ERROR',
          manager,
        );
        return;
      }

      const targetStatus = mapWebhookDataStatus(verifiedData);
      await this.transitionService.applyProviderStatus(
        payment,
        targetStatus,
        manager,
      );
      await this.webhookEventsRepository.markProcessed(
        insertOutcome.event.id,
        'SUCCESS',
        manager,
      );
    });
  }

  assertOwnership(orderUserId: string, requestUserId: string): void {
    if (orderUserId !== requestUserId) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'Bạn không có quyền truy cập thanh toán này',
      });
    }
  }

  private withinCooldown(payment: PaymentEntity): boolean {
    if (!payment.lastSyncedAt) return false;
    const elapsedMs =
      this.clock.now().getTime() - payment.lastSyncedAt.getTime();
    return elapsedMs < this.payosConfig.syncCooldownSeconds * 1000;
  }

  private toStatusResponse(payment: PaymentEntity): PaymentStatusResponseDto {
    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      paymentMethod: payment.provider,
      paymentStatus: payment.status,
      orderStatus: payment.order?.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      isTerminal: TERMINAL_PAYMENT_STATUSES.has(payment.status),
      checkoutUrl:
        payment.provider === PaymentProvider.PAYOS &&
        payment.status === PaymentStatus.PENDING
          ? payment.checkoutUrl
          : null,
    };
  }
}
