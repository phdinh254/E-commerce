import { EntityManager } from 'typeorm';
import { ProductAttributeEntity } from '../../../modules/products/attributes/entities/product-attribute.entity';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';
import { ProductAttributeSeedRecordDto } from '../dto/product-attribute-seed-record.dto';

export interface ProductAttributesSeedResult {
  created: number;
  updated: number;
}

/** Natural key: (productId, normalized name) — matches `UQ_product_attributes_product_id_normalized_name_active`. */
export async function seedProductAttributes(
  manager: EntityManager,
  records: ProductAttributeSeedRecordDto[],
  productSlugToId: Map<string, string>,
): Promise<ProductAttributesSeedResult> {
  const repository = manager.getRepository(ProductAttributeEntity);
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const productId = productSlugToId.get(record.productSlug);
    if (!productId) {
      throw new Error(
        `seedProductAttributes: product "${record.productSlug}" was not resolved`,
      );
    }
    const normalizedName = normalizeLabel(record.name);

    const existing = await repository.findOne({
      where: { productId, normalizedName },
    });
    if (existing) {
      existing.value = record.value;
      existing.unit = record.unit ?? null;
      existing.displayOrder = record.displayOrder ?? existing.displayOrder;
      existing.isVisible = record.isVisible ?? existing.isVisible;
      await repository.save(existing);
      updated += 1;
      continue;
    }

    const createdEntity = repository.create({
      productId,
      name: record.name,
      normalizedName,
      value: record.value,
      unit: record.unit ?? null,
      displayOrder: record.displayOrder ?? 0,
      isVisible: record.isVisible ?? true,
    });
    await repository.save(createdEntity);
    created += 1;
  }

  return { created, updated };
}
