import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CouponEntity } from './coupon.entity';
import { OrderEntity } from '../../cart/entities/order.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * The redemption record IS the usage-count guarantee: `usedCount` on
 * CouponEntity only ever moves inside the same transaction that inserts a
 * row here, and `UQ_coupon_redemptions_order_id` (one row per order) is
 * what makes a retried/duplicate confirmation a safe no-op instead of a
 * double-count — same "unique-constraint-is-the-lock" philosophy as
 * guest_claims/idempotency_keys.
 *
 * `discountAmount`/`couponCodeSnapshot` freeze the redeemed amount and code
 * text independently of the live Coupon row, so a later Coupon edit or
 * soft-delete can never rewrite a historical order's numbers.
 */
@Entity({ name: 'coupon_redemptions' })
@Index('IDX_coupon_redemptions_coupon_id_user_id', ['couponId', 'userId'])
@Index('UQ_coupon_redemptions_order_id', ['orderId'], { unique: true })
@Check(
  'CHK_coupon_redemptions_discount_amount_non_negative',
  '"discount_amount" >= 0',
)
export class CouponRedemptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @ManyToOne(() => CouponEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'discount_amount', type: 'integer' })
  discountAmount: number;

  @Column({ name: 'coupon_code_snapshot', type: 'varchar', length: 50 })
  couponCodeSnapshot: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
