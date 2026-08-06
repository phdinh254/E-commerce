import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ValueTransformer } from 'typeorm';
import { OrderEntity } from '../../cart/entities/order.entity';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/** Postgres `bigint` round-trips through node-postgres as a string by
 * default — PayOS orderCode values (from `payos_order_code_seq`, starting
 * at 100,000,000) never approach Number.MAX_SAFE_INTEGER for the life of
 * this project, so converting to/from `number` here is safe and keeps the
 * rest of the codebase from having to special-case a string ID. */
const bigintTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * One Order can have MULTIPLE Payment attempts (PayOS retry after a
 * cancelled/expired link) — no single-column unique on order_id, only
 * `(provider, provider_order_code)` (see migration). COD creates exactly
 * one Payment row, synchronously, already PAID (no gateway call) — this
 * unifies the status endpoint (Ch17-B170) to always read from `payments`
 * regardless of method, instead of Order carrying a second, divergent
 * payment-status source of truth.
 */
@Entity({ name: 'payments' })
@Index('IDX_payments_order_id', ['orderId'])
@Index('IDX_payments_order_id_status', ['orderId', 'status'])
@Index('UQ_payments_provider_order_code', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Check('CHK_payments_amount_positive', '"amount" > 0')
@Check('CHK_payments_attempt_number_positive', '"attempt_number" > 0')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /** Integer VND — snapshot of Order.totalAmount at attempt-creation time. */
  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({
    name: 'provider_order_code',
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  providerOrderCode: number | null;

  @Column({
    name: 'provider_payment_link_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerPaymentLinkId: string | null;

  @Column({
    name: 'checkout_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  checkoutUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'attempt_number', type: 'integer', default: 1 })
  attemptNumber: number;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  failureReason: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
