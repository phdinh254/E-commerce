import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CategorySortField } from './dto/query-category.dto';

export interface CategoryListFilters {
  page: number;
  limit: number;
  search?: string;
  parentId?: string;
  activeOnly: boolean;
  sortBy: CategorySortField;
  sortOrder: 'ASC' | 'DESC';
}

const SORT_COLUMN_MAP: Record<CategorySortField, string> = {
  name: 'category.name',
  displayOrder: 'category.display_order',
  createdAt: 'category.created_at',
};

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repository: Repository<CategoryEntity>,
  ) {}

  create(data: Partial<CategoryEntity>): CategoryEntity {
    return this.repository.create(data);
  }

  save(category: CategoryEntity): Promise<CategoryEntity> {
    return this.repository.save(category);
  }

  /** Excludes soft-deleted rows (TypeORM default scope); does not filter by isActive. */
  findById(id: string): Promise<CategoryEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /** Slugs are always stored already-normalized (lowercase), so exact match is sufficient. */
  findBySlug(slug: string): Promise<CategoryEntity | null> {
    return this.repository.findOne({ where: { slug } });
  }

  countChildren(parentId: string): Promise<number> {
    return this.repository.count({ where: { parentId } });
  }

  async findParentChain(startId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = startId;
    const MAX_DEPTH = 100;

    for (let depth = 0; currentId && depth < MAX_DEPTH; depth += 1) {
      const current: Pick<CategoryEntity, 'id' | 'parentId'> | null =
        await this.repository.findOne({
          where: { id: currentId },
          select: ['id', 'parentId'],
        });
      if (!current) break;
      chain.push(current.id);
      currentId = current.parentId;
    }

    return chain;
  }

  async findMany(
    filters: CategoryListFilters,
  ): Promise<[CategoryEntity[], number]> {
    const qb = this.repository.createQueryBuilder('category');

    if (filters.activeOnly) {
      qb.andWhere('category.is_active = :isActive', { isActive: true });
    }

    if (filters.search) {
      qb.andWhere('category.name ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.parentId) {
      qb.andWhere('category.parent_id = :parentId', {
        parentId: filters.parentId,
      });
    }

    qb.orderBy(SORT_COLUMN_MAP[filters.sortBy], filters.sortOrder);
    qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

    return qb.getManyAndCount();
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}
