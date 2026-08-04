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
import { ProductEntity } from '../../entities/product.entity';
import { ProductVariantOptionValueEntity } from './product-variant-option-value.entity';

/**
 * `sku` is unique across the whole table (not scoped per product) via a
 * functional `upper(sku)` index — mirrors ProductEntity.sku, deliberately
 * NOT merged into Product.sku's own unique namespace (see
 * docs/product-variant-business-rules.md for why).
 *
 * `combinationKey` is backend-only identity, never accepted from a client
 * — see combination-key.util.ts. `(product_id, combination_key)` unique
 * together is what actually prevents a duplicate combination, not an
 * application-level SELECT check.
 *
 * No `deletedAt`: Chapter 10 has no variant-delete endpoint, so a
 * soft-delete column would be dead weight — see business rules doc.
 */
@Entity({ name: 'product_variants' })
@Index('IDX_product_variants_product_id', ['productId'])
@Index('IDX_product_variants_product_id_is_active', ['productId', 'isActive'])
@Index(
  'UQ_product_variants_product_id_combination_key',
  ['productId', 'combinationKey'],
  { unique: true },
)
@Check('CHK_product_variants_price_non_negative', '"price" >= 0')
@Check('CHK_product_variants_stock_non_negative', '"stock" >= 0')
export class ProductVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Index('UQ_product_variants_sku_upper', {
    unique: true,
    synchronize: false,
  } as unknown as { synchronize: false })
  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ name: 'combination_key', type: 'varchar', length: 64 })
  combinationKey: string;

  /** Integer VND — snapshot at creation time, see business rules doc. */
  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ProductVariantOptionValueEntity, (join) => join.variant)
  optionValues: ProductVariantOptionValueEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
