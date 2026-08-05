import { EntityManager } from 'typeorm';
import { ProductOptionEntity } from '../../../modules/products/variants/entities/product-option.entity';
import { ProductOptionValueEntity } from '../../../modules/products/variants/entities/product-option-value.entity';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';
import { ProductOptionSeedRecordDto } from '../dto/product-option-seed-record.dto';

export interface ProductOptionsSeedResult {
  created: number;
  updated: number;
  /** key: `${productSlug}::${normalizedOptionName}` -> optionId */
  optionKeyToId: Map<string, string>;
  /** key: `${productSlug}::${normalizedOptionName}::${normalizedValue}` -> { optionValueId, optionId } */
  valueKeyToId: Map<string, { optionValueId: string; optionId: string }>;
}

/**
 * Natural key: (productSlug, normalized option name) for options, and
 * (option, normalized value) for values — matches the DB's own
 * `UQ_product_options_product_id_normalized_name` /
 * `UQ_product_option_values_option_id_normalized_value` unique indexes.
 */
export async function seedProductOptions(
  manager: EntityManager,
  records: ProductOptionSeedRecordDto[],
  productSlugToId: Map<string, string>,
): Promise<ProductOptionsSeedResult> {
  const optionRepository = manager.getRepository(ProductOptionEntity);
  const valueRepository = manager.getRepository(ProductOptionValueEntity);

  const optionKeyToId = new Map<string, string>();
  const valueKeyToId = new Map<
    string,
    { optionValueId: string; optionId: string }
  >();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const productId = productSlugToId.get(record.productSlug);
    if (!productId) {
      throw new Error(
        `seedProductOptions: product "${record.productSlug}" was not resolved`,
      );
    }
    const normalizedName = normalizeLabel(record.name);

    let option = await optionRepository.findOne({
      where: { productId, normalizedName },
    });
    if (option) {
      option.name = record.name;
      option.displayOrder = record.displayOrder ?? option.displayOrder;
      await optionRepository.save(option);
      updated += 1;
    } else {
      option = optionRepository.create({
        productId,
        name: record.name,
        normalizedName,
        displayOrder: record.displayOrder ?? 0,
      });
      await optionRepository.save(option);
      created += 1;
    }
    optionKeyToId.set(`${record.productSlug}::${normalizedName}`, option.id);

    for (const valueRecord of record.values) {
      const normalizedValue = normalizeLabel(valueRecord.value);
      let value = await valueRepository.findOne({
        where: { optionId: option.id, normalizedValue },
      });
      if (value) {
        value.value = valueRecord.value;
        value.displayOrder = valueRecord.displayOrder ?? value.displayOrder;
        await valueRepository.save(value);
      } else {
        value = valueRepository.create({
          optionId: option.id,
          value: valueRecord.value,
          normalizedValue,
          displayOrder: valueRecord.displayOrder ?? 0,
        });
        await valueRepository.save(value);
      }
      valueKeyToId.set(
        `${record.productSlug}::${normalizedName}::${normalizedValue}`,
        { optionValueId: value.id, optionId: option.id },
      );
    }
  }

  return { created, updated, optionKeyToId, valueKeyToId };
}
