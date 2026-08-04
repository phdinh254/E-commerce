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
import { ProductEntity } from '../../entities/product.entity';

/**
 * Unlike Product/Category slug (globally unique forever, even
 * soft-deleted), an attribute name is reusable after delete — it is
 * internal descriptive metadata with no external/URL identity, so there
 * is no broken-link risk in letting it be recreated. Enforced via a
 * PARTIAL unique index (`WHERE deleted_at IS NULL`) declared in the
 * migration, not expressible through TypeORM decorator options — same
 * `synchronize: false` documentation-only pattern already used for
 * Product/Category's functional slug indexes.
 */
@Entity({ name: 'product_attributes' })
@Index('IDX_product_attributes_product_id', ['productId'])
@Index('UQ_product_attributes_product_id_normalized_name_active', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Check(
  'CHK_product_attributes_display_order_non_negative',
  '"display_order" >= 0',
)
export class ProductAttributeEntity {
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

  @Column({ type: 'varchar', length: 500 })
  value: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
