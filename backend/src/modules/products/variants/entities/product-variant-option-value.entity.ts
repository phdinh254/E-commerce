import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductOptionValueEntity } from './product-option-value.entity';

/**
 * Join table between Variant and OptionValue. The composite primary key
 * alone only prevents the exact same pair being inserted twice — it does
 * NOT enforce "exactly one value per option" or "no missing option"; that
 * validation happens in ProductVariantsService before the insert, inside
 * the same transaction as the variant row itself (see
 * docs/product-variant-business-rules.md).
 */
@Entity({ name: 'product_variant_option_values' })
@Index('IDX_product_variant_option_values_option_value_id', ['optionValueId'])
export class ProductVariantOptionValueEntity {
  @PrimaryColumn({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => ProductVariantEntity, (variant) => variant.optionValues, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariantEntity;

  @PrimaryColumn({ name: 'option_value_id', type: 'uuid' })
  optionValueId: string;

  @ManyToOne(() => ProductOptionValueEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'option_value_id' })
  optionValue: ProductOptionValueEntity;

  /**
   * Denormalized from `optionValue.optionId` at insert time (the service
   * already has it loaded there). Lets the variant-listing query group
   * option values by option without a second join through
   * product_option_values → product_options for every row.
   */
  @Column({ name: 'option_id', type: 'uuid' })
  optionId: string;
}
