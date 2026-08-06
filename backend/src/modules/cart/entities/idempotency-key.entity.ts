import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Persistent Idempotency-Key store, modeled on GuestClaimEntity's
 * unique-constraint-is-the-lock approach (see guest_claims). Scoped by
 * (userId, operation, idempotencyKey) so the same raw key string can't
 * collide across unrelated operations. requestHash lets the service detect
 * "same key, different payload" and reject instead of silently replaying
 * the wrong response. responseStatus/responseBody are the durable replay
 * payload — this is intentionally NOT an in-memory cache.
 */
@Entity({ name: 'idempotency_keys' })
@Index('IDX_idempotency_keys_created_at', ['createdAt'])
@Index(
  'UQ_idempotency_keys_user_operation_key',
  ['userId', 'operation', 'idempotencyKey'],
  { unique: true },
)
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 64 })
  operation: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ name: 'response_status', type: 'integer' })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
