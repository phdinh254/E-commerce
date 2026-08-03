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
 * The single source of truth for claim idempotency. `guestId` (the sha256
 * hash of the guest cookie, never the raw cookie) is unique — the first
 * successful `INSERT ... ON CONFLICT (guest_id) DO NOTHING` for a given
 * guest wins the claim; every later attempt (retry, concurrent request,
 * a different user) resolves by reading this row instead of racing Redis.
 */
@Entity({ name: 'guest_claims' })
export class GuestClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_guest_claims_guest_id', { unique: true })
  @Column({ name: 'guest_id', type: 'varchar', length: 64 })
  guestId: string;

  @Index('IDX_guest_claims_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @CreateDateColumn({ name: 'claimed_at', type: 'timestamptz' })
  claimedAt: Date;
}
