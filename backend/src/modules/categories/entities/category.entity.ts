import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * parent_id is nullable (root categories have no parent) and self-referencing
 * with ON DELETE RESTRICT: a category with children cannot be hard-deleted,
 * and children never get silently orphaned or re-parented to root.
 *
 * The CHK_categories_parent_not_self check only rejects a category being its
 * own direct parent. It cannot detect multi-level cycles (A -> B -> C -> A);
 * that must be enforced by the future Category service inside a transaction.
 */
@Entity({ name: 'categories' })
@Index('IDX_categories_parent_id_display_order', ['parentId', 'displayOrder'])
@Check(
  'CHK_categories_parent_not_self',
  '"parent_id" IS NULL OR "parent_id" <> "id"',
)
@Check('CHK_categories_display_order_non_negative', '"display_order" >= 0')
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => CategoryEntity, (category) => category.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: CategoryEntity | null;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children: CategoryEntity[];

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Uniqueness is enforced at the database level by a case-insensitive
   * functional index on lower(slug) (see the CreateCategories +
   * CategorySlugCaseInsensitiveUnique migrations), not by a plain column
   * constraint here. TypeORM can't express a lower(slug) index via decorator
   * options, so this is declared with `synchronize: false` purely as
   * documentation — schema:log/synchronize must not try to manage it.
   */
  @Index('UQ_categories_slug_lower', {
    unique: true,
    synchronize: false,
  } as unknown as { synchronize: false })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
