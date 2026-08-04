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

/**
 * price is an integer count of VND (Vietnamese Dong has no minor/subunit in
 * common use), never a float — this sidesteps floating-point currency
 * precision issues entirely rather than needing a numeric-column transformer.
 *
 * slug and sku both use a case-insensitive functional unique index (like
 * CategoryEntity.slug) rather than a plain column-level unique flag, for the
 * same reason: defense in depth even if a caller bypasses normalization.
 * Both stay globally unique including soft-deleted rows — deleted values are
 * not recycled, matching the Category precedent.
 */
@Entity({ name: 'products' })
@Index('IDX_products_category_id', ['categoryId'])
@Index('IDX_products_is_active', ['isActive'])
@Index('IDX_products_is_featured_display_order', [
  'isFeatured',
  'featuredOrder',
])
@Check('CHK_products_price_non_negative', '"price" >= 0')
@Check('CHK_products_featured_order_non_negative', '"featured_order" >= 0')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: false,
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('UQ_products_slug_lower', {
    unique: true,
    synchronize: false,
  } as unknown as {
    synchronize: false;
  })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Index('UQ_products_sku_upper', {
    unique: true,
    synchronize: false,
  } as unknown as {
    synchronize: false;
  })
  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({
    name: 'short_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  shortDescription: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Integer VND — see class-level comment. */
  @Column({ type: 'integer' })
  price: number;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  thumbnailUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'featured_order', type: 'int', default: 0 })
  featuredOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
