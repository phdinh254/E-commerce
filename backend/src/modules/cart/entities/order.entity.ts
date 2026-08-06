import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import {
  CouponDiscountType,
  CouponEntity,
} from '../../coupons/entities/coupon.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItemEntity } from './order-item.entity';

/**
 * Cart-is-order: this row IS the user's cart while status = CART. The DB
 * enforces "at most one active CART order per user" via a partial unique
 * index on (user_id) WHERE status = 'CART' (see the Ch15 migration) — not
 * merely a service-level check, so it survives concurrent requests.
 *
 * subtotal/total are integer VND, recomputed server-side from order_items
 * on every mutation — never trusted from the client. total = subtotal in
 * this chapter (no shipping/discount yet); the column exists now so a
 * later checkout chapter does not need a schema change.
 */
@Entity({ name: 'orders' })
@Index('IDX_orders_user_id', ['userId'])
@Index('IDX_orders_status', ['status'])
// Partial unique index (WHERE status = 'CART') — not expressible through
// plain TypeORM decorator options, declared in the Ch15 migration.
// `synchronize: false` documentation-only, same pattern as
// ProductAttributeEntity's partial unique index.
@Index('UQ_orders_user_id_active_cart', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Index('IDX_orders_coupon_id', ['couponId'])
@Check('CHK_orders_subtotal_amount_non_negative', '"subtotal_amount" >= 0')
@Check('CHK_orders_total_amount_non_negative', '"total_amount" >= 0')
@Check('CHK_orders_discount_amount_non_negative', '"discount_amount" >= 0')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CART })
  status: OrderStatus;

  @Column({ name: 'subtotal_amount', type: 'integer', default: 0 })
  subtotalAmount: number;

  @Column({ name: 'total_amount', type: 'integer', default: 0 })
  totalAmount: number;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne(() => CouponEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity | null;

  /**
   * Snapshot fields — mirrored from the live Coupon at apply-time and kept
   * in sync by CartPricingService.revalidateCoupon on every mutation while
   * status=CART. A later checkout chapter freezes these permanently at
   * order confirmation (Ch16-B159's redeemForOrder) so a historical order's
   * numbers never depend on a Coupon row that can still be edited.
   */
  @Column({
    name: 'coupon_code_snapshot',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  couponCodeSnapshot: string | null;

  @Column({
    name: 'coupon_name_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  couponNameSnapshot: string | null;

  @Column({
    name: 'coupon_discount_type_snapshot',
    type: 'enum',
    enum: CouponDiscountType,
    nullable: true,
  })
  couponDiscountTypeSnapshot: CouponDiscountType | null;

  @Column({
    name: 'coupon_discount_value_snapshot',
    type: 'integer',
    nullable: true,
  })
  couponDiscountValueSnapshot: number | null;

  @Column({ name: 'discount_amount', type: 'integer', default: 0 })
  discountAmount: number;

  /**
   * Shipping snapshot — AddressesModule is entity-only (no service yet), so
   * Checkout (Ch17) accepts these fields directly on the request DTO and
   * freezes them here instead of depending on an unfinished module. Field
   * names mirror AddressEntity's own columns.
   */
  @Column({
    name: 'shipping_recipient_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shippingRecipientName: string | null;

  @Column({
    name: 'shipping_phone_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  shippingPhoneNumber: string | null;

  @Column({
    name: 'shipping_province',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shippingProvince: string | null;

  @Column({
    name: 'shipping_district',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shippingDistrict: string | null;

  @Column({
    name: 'shipping_ward',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shippingWard: string | null;

  @Column({
    name: 'shipping_street_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shippingStreetAddress: string | null;

  @Column({
    name: 'shipping_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  shippingNote: string | null;

  /** When the order left CART (COD/PayOS placement). Null while still a cart. */
  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt: Date | null;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: OrderItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
