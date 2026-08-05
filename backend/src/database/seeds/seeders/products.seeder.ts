import { EntityManager } from 'typeorm';
import { ProductEntity } from '../../../modules/products/entities/product.entity';
import { ProductSeedRecordDto } from '../dto/product-seed-record.dto';

export interface ProductsSeedResult {
  created: number;
  updated: number;
  slugToId: Map<string, string>;
}

/** Natural key: slug (sku uniqueness is also enforced by the DB — cross-file validation already checked both are duplicate-free). */
export async function seedProducts(
  manager: EntityManager,
  records: ProductSeedRecordDto[],
  categorySlugToId: Map<string, string>,
): Promise<ProductsSeedResult> {
  const repository = manager.getRepository(ProductEntity);
  const slugToId = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const categoryId = categorySlugToId.get(record.categorySlug);
    if (!categoryId) {
      throw new Error(
        `seedProducts: category "${record.categorySlug}" was not resolved (should have been caught by cross-file validation)`,
      );
    }

    const existing = await repository.findOne({ where: { slug: record.slug } });
    if (existing) {
      if (existing.deletedAt) {
        slugToId.set(record.slug, existing.id);
        continue;
      }
      existing.categoryId = categoryId;
      existing.name = record.name;
      existing.sku = record.sku;
      existing.shortDescription = record.shortDescription ?? null;
      existing.description = record.description ?? null;
      existing.price = record.price;
      existing.thumbnailUrl = record.thumbnailUrl ?? null;
      existing.isActive = record.isActive ?? existing.isActive;
      existing.isFeatured = record.isFeatured ?? existing.isFeatured;
      existing.featuredOrder = record.featuredOrder ?? existing.featuredOrder;
      await repository.save(existing);
      slugToId.set(record.slug, existing.id);
      updated += 1;
      continue;
    }

    const createdEntity = repository.create({
      categoryId,
      name: record.name,
      slug: record.slug,
      sku: record.sku,
      shortDescription: record.shortDescription ?? null,
      description: record.description ?? null,
      price: record.price,
      thumbnailUrl: record.thumbnailUrl ?? null,
      isActive: record.isActive ?? true,
      isFeatured: record.isFeatured ?? false,
      featuredOrder: record.featuredOrder ?? 0,
    });
    await repository.save(createdEntity);
    slugToId.set(record.slug, createdEntity.id);
    created += 1;
  }

  return { created, updated, slugToId };
}
