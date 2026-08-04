import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from '../../entities/product.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { VariantChangeType } from '../enums/variant-change-type.enum';
import { UserEntity } from '../../../users/entities/user.entity';

/**
 * Immutable audit trail — no update/delete path exists anywhere in this
 * codebase for this entity (no repository method, no controller route).
 * `onDelete: 'RESTRICT'` on both product/variant foreign keys is
 * deliberate: audit history must survive even a hypothetical future hard
 * delete of the product/variant it describes (unlike the CASCADE used for
 * option/value/variant themselves, which have no independent meaning
 * without their product).
 */
@Entity({ name: 'product_variant_change_logs' })
@Index('IDX_product_variant_change_logs_variant_id_created_at', [
  'variantId',
  'createdAt',
])
export class ProductVariantChangeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => ProductVariantEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariantEntity;

  @Column({
    name: 'change_type',
    type: 'enum',
    enum: VariantChangeType,
    enumName: 'product_variant_change_type',
  })
  changeType: VariantChangeType;

  @Column({ name: 'old_value', type: 'integer' })
  oldValue: number;

  @Column({ name: 'new_value', type: 'integer' })
  newValue: number;

  @Column({ type: 'integer' })
  delta: number;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: UserEntity;

  /** Shared by up to two rows (PRICE + STOCK) written from the same
   * PATCH request, so they can be correlated as "one mutation". */
  @Column({ name: 'mutation_id', type: 'uuid' })
  mutationId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
