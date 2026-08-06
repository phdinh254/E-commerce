import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { ProductEntity } from '../../products/entities/product.entity';

export enum CouponDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/**
 * Minimal Coupon schema added as a Chapter 12 prerequisite — no Coupon
 * table existed anywhere in the repository before this. There is no
 * Cart/Order/Checkout module yet, so `usedCount` only ever moves via a
 * (not-yet-built) redemption flow; Chapter 12 seed data never sets it to
 * anything but 0 (see docs/seed-strategy.md).
 *
 * `discountValue` is a plain integer for both types: PERCENTAGE stores
 * 1-100 (a percentage point count, like Product.price's "integer VND, no
 * float" precedent), FIXED stores an integer VND amount — enforced by the
 * CHK_coupons_discount_value_valid_for_type check rather than two columns,
 * to keep the natural-key/business-rule shape close to what Ch12-B114
 * describes.
 *
 * `applicableCategoryId`/`applicableProductId` are both nullable and
 * independent — a coupon can be unrestricted (both null), scoped to one
 * category, or scoped to one product. Enforcing "at most one of the two"
 * is an application-level rule (seed validation), not a DB constraint,
 * matching how this codebase already keeps cross-field business rules in
 * services/seeders rather than SQL CHECK expressions that would need a
 * function.
 */
@Entity({ name: 'coupons' })
@Index('IDX_coupons_is_active', ['isActive'])
@Index('IDX_coupons_applicable_category_id', ['applicableCategoryId'])
@Index('IDX_coupons_applicable_product_id', ['applicableProductId'])
@Index('IDX_coupons_is_featured_featured_order', [
  'isFeatured',
  'featuredOrder',
])
@Check('CHK_coupons_featured_order_non_negative', '"featured_order" >= 0')
@Check(
  'CHK_coupons_discount_value_valid_for_type',
  `("discount_type" = 'PERCENTAGE' AND "discount_value" > 0 AND "discount_value" <= 100) OR ("discount_type" = 'FIXED' AND "discount_value" > 0)`,
)
@Check('CHK_coupons_min_order_amount_non_negative', '"min_order_amount" >= 0')
@Check(
  'CHK_coupons_max_discount_amount_non_negative',
  '"max_discount_amount" IS NULL OR "max_discount_amount" >= 0',
)
@Check('CHK_coupons_ends_after_starts', '"ends_at" > "starts_at"')
@Check(
  'CHK_coupons_usage_limit_positive',
  '"usage_limit" IS NULL OR "usage_limit" > 0',
)
@Check(
  'CHK_coupons_per_user_limit_positive',
  '"per_user_limit" IS NULL OR "per_user_limit" > 0',
)
@Check('CHK_coupons_used_count_non_negative', '"used_count" >= 0')
export class CouponEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Case-insensitive uniqueness via a functional upper(code) index — see migration. */
  @Index('UQ_coupons_code_upper', {
    unique: true,
    synchronize: false,
  } as unknown as {
    synchronize: false;
  })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  /** Ch16 gap-fill (Ch12 entity never had this) — nullable so existing seed
   * rows stay valid; used for featured/applied-coupon display. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: CouponDiscountType,
  })
  discountType: CouponDiscountType;

  @Column({ name: 'discount_value', type: 'integer' })
  discountValue: number;

  @Column({ name: 'min_order_amount', type: 'integer', default: 0 })
  minOrderAmount: number;

  @Column({ name: 'max_discount_amount', type: 'integer', nullable: true })
  maxDiscountAmount: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ name: 'usage_limit', type: 'integer', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'per_user_limit', type: 'integer', nullable: true })
  perUserLimit: number | null;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'applicable_category_id', type: 'uuid', nullable: true })
  applicableCategoryId: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'applicable_category_id' })
  applicableCategory: CategoryEntity | null;

  @Column({ name: 'applicable_product_id', type: 'uuid', nullable: true })
  applicableProductId: string | null;

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'applicable_product_id' })
  applicableProduct: ProductEntity | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'featured_order', type: 'integer', default: 0 })
  featuredOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
