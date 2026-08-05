import { EntityManager } from 'typeorm';
import { ProductVariantEntity } from '../../../modules/products/variants/entities/product-variant.entity';
import { ProductVariantOptionValueEntity } from '../../../modules/products/variants/entities/product-variant-option-value.entity';
import { ProductEntity } from '../../../modules/products/entities/product.entity';
import { buildCombinationKey } from '../../../modules/products/variants/combination-key.util';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';
import { ProductVariantSeedRecordDto } from '../dto/product-variant-seed-record.dto';

export interface ProductVariantsSeedResult {
  created: number;
  updated: number;
  skuToId: Map<string, string>;
  skuToProductSlug: Map<string, string>;
}

/** Natural key: sku (unique table-wide, matching `UQ_product_variants_sku_upper`). */
export async function seedProductVariants(
  manager: EntityManager,
  records: ProductVariantSeedRecordDto[],
  productSlugToId: Map<string, string>,
  valueKeyToId: Map<string, { optionValueId: string; optionId: string }>,
): Promise<ProductVariantsSeedResult> {
  const variantRepository = manager.getRepository(ProductVariantEntity);
  const joinRepository = manager.getRepository(ProductVariantOptionValueEntity);
  const productRepository = manager.getRepository(ProductEntity);

  const skuToId = new Map<string, string>();
  const skuToProductSlug = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const productId = productSlugToId.get(record.productSlug);
    if (!productId) {
      throw new Error(
        `seedProductVariants: product "${record.productSlug}" was not resolved`,
      );
    }
    const normalizedSku = record.sku.trim().toUpperCase();

    const pairs = record.optionValues.map((ov) => {
      const key = `${record.productSlug}::${normalizeLabel(ov.optionName)}::${normalizeLabel(ov.value)}`;
      const resolved = valueKeyToId.get(key);
      if (!resolved) {
        throw new Error(
          `seedProductVariants: option value "${ov.optionName}=${ov.value}" for product "${record.productSlug}" was not resolved`,
        );
      }
      return {
        optionId: resolved.optionId,
        optionValueId: resolved.optionValueId,
      };
    });
    const combinationKey = buildCombinationKey(pairs);

    let variant = await variantRepository.findOne({
      where: { sku: normalizedSku },
    });
    if (variant) {
      variant.price = record.price ?? variant.price;
      variant.stock = record.stock ?? variant.stock;
      variant.isActive = record.isActive ?? variant.isActive;
      await variantRepository.save(variant);
      updated += 1;
    } else {
      const product = await productRepository.findOne({
        where: { id: productId },
      });
      const price = record.price ?? product?.price ?? 0;
      variant = variantRepository.create({
        productId,
        sku: normalizedSku,
        combinationKey,
        price,
        stock: record.stock ?? 0,
        isActive: record.isActive ?? true,
      });
      await variantRepository.save(variant);

      await joinRepository.save(
        pairs.map((pair) =>
          joinRepository.create({
            variantId: variant!.id,
            optionValueId: pair.optionValueId,
            optionId: pair.optionId,
          }),
        ),
      );
      created += 1;
    }
    skuToId.set(normalizedSku, variant.id);
    skuToProductSlug.set(normalizedSku, record.productSlug);
  }

  return { created, updated, skuToId, skuToProductSlug };
}
