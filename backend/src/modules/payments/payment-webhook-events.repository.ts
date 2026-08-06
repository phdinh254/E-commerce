import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PaymentWebhookEventEntity } from './entities/payment-webhook-event.entity';
import { PaymentProvider } from './enums/payment-provider.enum';

export type WebhookEventInsertOutcome =
  | { kind: 'inserted'; event: PaymentWebhookEventEntity }
  | { kind: 'already-processed'; event: PaymentWebhookEventEntity };

@Injectable()
export class PaymentWebhookEventsRepository {
  /**
   * Atomic idempotency check-and-insert, mirroring GuestClaimsRepository/
   * CouponRedemptionsRepository.insertIfAbsent: relies on
   * `UQ_payment_webhook_events_provider_key`, not application-level
   * locking. A resent identical webhook payload has exactly one INSERT
   * succeed; every other caller reads back the winner's row and must
   * treat it as already-processed, never re-applying side effects.
   */
  async insertIfAbsent(
    params: {
      provider: PaymentProvider;
      externalEventKey: string;
      providerOrderCode: number | null;
      eventStatus: string | null;
    },
    manager: EntityManager,
  ): Promise<WebhookEventInsertOutcome> {
    const repo = manager.getRepository(PaymentWebhookEventEntity);

    const result = await repo
      .createQueryBuilder()
      .insert()
      .into(PaymentWebhookEventEntity)
      .values({
        provider: params.provider,
        externalEventKey: params.externalEventKey,
        providerOrderCode: params.providerOrderCode,
        eventStatus: params.eventStatus,
        // Placeholder — finalized by markProcessed() once outcome is known,
        // in the same transaction.
        processingResult: 'IGNORED',
        receivedAt: new Date(),
      })
      .orIgnore()
      .returning('*')
      .execute();

    const raw = result.raw as PaymentWebhookEventEntity[];
    if (raw.length > 0) {
      return { kind: 'inserted', event: raw[0] };
    }

    const existing = await repo.findOneOrFail({
      where: {
        provider: params.provider,
        externalEventKey: params.externalEventKey,
      },
    });
    return { kind: 'already-processed', event: existing };
  }

  async markProcessed(
    id: string,
    result: 'SUCCESS' | 'IGNORED' | 'ERROR',
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(PaymentWebhookEventEntity)
      .update({ id }, { processingResult: result, processedAt: new Date() });
  }
}
