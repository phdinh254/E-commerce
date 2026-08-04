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
import { ProductOptionEntity } from './product-option.entity';

@Entity({ name: 'product_option_values' })
@Index('IDX_product_option_values_option_id', ['optionId'])
@Index(
  'UQ_product_option_values_option_id_normalized_value',
  ['optionId', 'normalizedValue'],
  { unique: true },
)
@Check(
  'CHK_product_option_values_display_order_non_negative',
  '"display_order" >= 0',
)
export class ProductOptionValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'option_id', type: 'uuid' })
  optionId: string;

  @ManyToOne(() => ProductOptionEntity, (option) => option.values, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'option_id' })
  option: ProductOptionEntity;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ name: 'normalized_value', type: 'varchar', length: 100 })
  normalizedValue: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
