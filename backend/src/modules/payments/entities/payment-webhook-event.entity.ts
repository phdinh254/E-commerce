import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ValueTransformer } from 'typeorm';
import { PaymentProvider } from '../enums/payment-provider.enum';

const bigintTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Webhook dedup ledger — `externalEventKey` is `sha256(verifiedWebhookData)`
 * computed AFTER signature verification, so an identical resent payload
 * hashes identically and `UNIQUE(provider, external_event_key)` is the
 * actual guarantee that a callback is never processed twice — same
 * "unique-constraint-is-the-lock" philosophy as guest_claims/
 * idempotency_keys/coupon_redemptions.
 */
@Entity({ name: 'payment_webhook_events' })
@Index(
  'UQ_payment_webhook_events_provider_key',
  ['provider', 'externalEventKey'],
  {
    unique: true,
  },
)
@Index('IDX_payment_webhook_events_provider_order_code', ['providerOrderCode'])
export class PaymentWebhookEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({ name: 'external_event_key', type: 'varchar', length: 64 })
  externalEventKey: string;

  @Column({
    name: 'provider_order_code',
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  providerOrderCode: number | null;

  @Column({ name: 'event_status', type: 'varchar', length: 50, nullable: true })
  eventStatus: string | null;

  @Column({ name: 'processing_result', type: 'varchar', length: 20 })
  processingResult: 'SUCCESS' | 'IGNORED' | 'ERROR';

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
