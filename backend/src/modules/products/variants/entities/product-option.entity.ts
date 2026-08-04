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
import { ProductOptionValueEntity } from './product-option-value.entity';

/**
 * Belongs to exactly one Product — an option is never shared across
 * products. `normalizedName` is backend-computed (normalizeLabel — trim +
 * collapse whitespace + lowercase, diacritics preserved) purely for
 * case-insensitive duplicate detection within one product; it is never
 * shown to clients.
 */
@Entity({ name: 'product_options' })
@Index('IDX_product_options_product_id', ['productId'])
@Index(
  'UQ_product_options_product_id_normalized_name',
  ['productId', 'normalizedName'],
  { unique: true },
)
@Check('CHK_product_options_display_order_non_negative', '"display_order" >= 0')
export class ProductOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 100 })
  normalizedName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => ProductOptionValueEntity, (value) => value.option)
  values: ProductOptionValueEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
