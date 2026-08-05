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
import { ProductVariantEntity } from '../../variants/entities/product-variant.entity';
import { UserEntity } from '../../../users/entities/user.entity';

/**
 * `storageBucket`/`objectPath` are the source of truth for locating the
 * file in Supabase Storage — never a public URL (the bucket is private,
 * per docs/supabase-storage.md). A signed URL is generated fresh on every
 * response mapping and is never persisted here.
 *
 * FK `onDelete: RESTRICT` on both Product and ProductVariant — deliberately
 * NOT CASCADE (unlike ProductAttribute/ProductVariant's own FK to Product).
 * A database-level CASCADE delete cannot also delete the corresponding
 * Supabase object, so an unattended cascade would silently orphan storage
 * objects. Product/Variant deletion is soft-delete in this codebase anyway
 * (a real DELETE never runs in practice), so RESTRICT is a no-cost safety
 * net — see Ch11-B103/Ch11-B104 in the final report for the compensation
 * strategy this enables instead.
 *
 * No unique constraint on `variant_id` alone: a variant may have zero,
 * one, or many images. `variant_id` nullable = Product-level image.
 */
@Entity({ name: 'product_images' })
@Index('IDX_product_images_product_id', ['productId'])
@Index('IDX_product_images_variant_id', ['variantId'])
@Index('IDX_product_images_product_id_display_order', [
  'productId',
  'displayOrder',
])
@Index(
  'UQ_product_images_bucket_object_path',
  ['storageBucket', 'objectPath'],
  {
    unique: true,
  },
)
@Check('CHK_product_images_size_bytes_positive', '"size_bytes" > 0')
@Check('CHK_product_images_display_order_non_negative', '"display_order" >= 0')
export class ProductImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'storage_bucket', type: 'varchar', length: 255 })
  storageBucket: string;

  @Column({ name: 'object_path', type: 'varchar', length: 1024 })
  objectPath: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'alt_text', type: 'varchar', length: 500, nullable: true })
  altText: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
