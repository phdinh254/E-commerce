import { EntityManager } from 'typeorm';
import { CategoryEntity } from '../../../modules/categories/entities/category.entity';
import { CategorySeedRecordDto } from '../dto/category-seed-record.dto';

export interface CategoriesSeedResult {
  created: number;
  updated: number;
  slugToId: Map<string, string>;
}

/**
 * Natural key: slug. Two passes — insert/update every category first
 * (parentId left null), then resolve parentId by slug in a second pass —
 * so seed data order never has to put parents before children.
 */
export async function seedCategories(
  manager: EntityManager,
  records: CategorySeedRecordDto[],
): Promise<CategoriesSeedResult> {
  const repository = manager.getRepository(CategoryEntity);
  const slugToId = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const existing = await repository.findOne({ where: { slug: record.slug } });
    if (existing) {
      if (existing.deletedAt) {
        slugToId.set(record.slug, existing.id);
        continue;
      }
      existing.name = record.name;
      existing.description = record.description ?? null;
      existing.imageUrl = record.imageUrl ?? null;
      existing.displayOrder = record.displayOrder ?? existing.displayOrder;
      existing.isActive = record.isActive ?? existing.isActive;
      await repository.save(existing);
      slugToId.set(record.slug, existing.id);
      updated += 1;
      continue;
    }

    const createdEntity = repository.create({
      slug: record.slug,
      name: record.name,
      description: record.description ?? null,
      imageUrl: record.imageUrl ?? null,
      displayOrder: record.displayOrder ?? 0,
      isActive: record.isActive ?? true,
      parentId: null,
    });
    await repository.save(createdEntity);
    slugToId.set(record.slug, createdEntity.id);
    created += 1;
  }

  for (const record of records) {
    if (!record.parentSlug) continue;
    const id = slugToId.get(record.slug);
    const parentId = slugToId.get(record.parentSlug);
    if (!id || !parentId) continue; // already reported by cross-file validation if truly missing
    await repository.update({ id }, { parentId });
  }

  return { created, updated, slugToId };
}
