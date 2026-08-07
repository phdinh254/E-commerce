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
import { OrderEntity } from './order.entity';
import { ProductEntity } from '../../products/entities/product.entity';
import { ProductVariantEntity } from '../../products/variants/entities/product-variant.entity';

/**
 * Line identity is (order_id, product_id, variant_id). variant_id is
 * nullable (product without a required variant), so a plain
 * UNIQUE(order_id, product_id, variant_id) would NOT stop two NULL-variant
 * rows for the same product — Postgres treats NULL <> NULL. Enforced
 * instead by two partial unique indexes (see the Ch15 migration):
 * one for variant_id IS NOT NULL, one for variant_id IS NULL.
 *
 * unitPriceAmount is the price the backend resolved from Product/Variant at
 * add-time (integer VND) — a snapshot for cart display, not a payment
 * commitment. Checkout (a later chapter) must revalidate and freeze price.
 *
 * FKs to product/variant are ON DELETE RESTRICT (not CASCADE): a product or
 * variant must not silently vanish out from under an existing cart line.
 */
@Entity({ name: 'order_items' })
@Index('IDX_order_items_order_id', ['orderId'])
@Index('IDX_order_items_product_id', ['productId'])
@Index('IDX_order_items_variant_id', ['variantId'])
// Both partial unique indexes (WHERE variant_id IS [NOT] NULL) are declared
// in the Ch15 migration — `synchronize: false` documentation-only, same
// pattern as ProductAttributeEntity's partial unique index.
@Index('UQ_order_items_order_product_variant', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Index('UQ_order_items_order_product_null_variant', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Check('CHK_order_items_quantity_positive', '"quantity" > 0')
@Check(
  'CHK_order_items_unit_price_amount_non_negative',
  '"unit_price_amount" >= 0',
)
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @ManyToOne(() => ProductVariantEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariantEntity | null;

  @Column({ type: 'integer' })
  quantity: number;

  /** Integer VND — server-resolved snapshot at add-time, see class comment. */
  @Column({ name: 'unit_price_amount', type: 'integer' })
  unitPriceAmount: number;

  /**
   * Chapter 19 (Order Management) — product/sku/image snapshots captured at
   * checkout time so an order line still displays correctly (and audits
   * correctly) even after the underlying product/variant is later renamed,
   * re-priced, or deleted. Distinct from `unitPriceAmount`, which already
   * served this purpose for price.
   *
   * Nullable: the cart-is-order pattern means this row exists (as a CART or
   * PENDING_PAYMENT order line) before checkout ever runs. `null` here means
   * "not yet placed" — Task 2 populates these at order finalization in
   * checkout.service.ts, before the order leaves CART/PENDING_PAYMENT.
   */
  @Column({
    name: 'product_name_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  productNameSnapshot: string | null;

  @Column({
    name: 'sku_snapshot',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  skuSnapshot: string | null;

  @Column({
    name: 'image_url_snapshot',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  imageUrlSnapshot: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
