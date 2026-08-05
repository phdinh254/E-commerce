import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductSortField } from './dto/query-product.dto';
import { escapeLikePattern } from '../../common/utils/like-pattern.util';

export interface ProductListFilters {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  activeOnly: boolean;
  sortBy?: ProductSortField;
  sortOrder: 'ASC' | 'DESC';
  minPrice?: number;
  maxPrice?: number;
}

const SORT_COLUMN_MAP: Partial<Record<ProductSortField, string>> = {
  name: 'product.name',
  price: 'product.price',
  createdAt: 'product.created_at',
};

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repository: Repository<ProductEntity>,
  ) {}

  create(data: Partial<ProductEntity>): ProductEntity {
    return this.repository.create(data);
  }

  save(product: ProductEntity): Promise<ProductEntity> {
    return this.repository.save(product);
  }

  findById(id: string): Promise<ProductEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findBySlug(slug: string): Promise<ProductEntity | null> {
    return this.repository.findOne({ where: { slug } });
  }

  countByCategoryId(categoryId: string): Promise<number> {
    return this.repository.count({ where: { categoryId } });
  }

  async findMany(
    filters: ProductListFilters,
  ): Promise<[ProductEntity[], number]> {
    const qb = this.repository.createQueryBuilder('product');

    if (filters.activeOnly) {
      qb.andWhere('product.is_active = :isActive', { isActive: true });
    }
    if (filters.categoryId) {
      qb.andWhere('product.category_id = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    let effectiveSortBy = filters.sortBy;
    if (filters.search) {
      const escaped = escapeLikePattern(filters.search);
      qb.andWhere(
        "(product.name ILIKE :contains ESCAPE '\\' OR product.sku ILIKE :contains ESCAPE '\\' OR product.short_description ILIKE :contains ESCAPE '\\')",
        { contains: `%${escaped}%` },
      );

      if (!filters.sortBy) {
        effectiveSortBy = 'relevance';
      }

      if (effectiveSortBy === 'relevance') {
        qb.addSelect(
          `CASE
            WHEN upper(product.sku) = upper(:exactTerm) THEN 0
            WHEN product.name ILIKE :exactPattern ESCAPE '\\' THEN 1
            WHEN product.name ILIKE :prefixPattern ESCAPE '\\' THEN 2
            ELSE 3
          END`,
          'relevance_rank',
        );
        qb.setParameters({
          exactTerm: filters.search,
          exactPattern: escaped,
          prefixPattern: `${escaped}%`,
        });
        qb.orderBy('relevance_rank', 'ASC');
        qb.addOrderBy('product.name', 'ASC');
      }
    } else if (!effectiveSortBy || effectiveSortBy === 'relevance') {
      effectiveSortBy = 'createdAt';
    }

    const resolvedSortBy: ProductSortField = effectiveSortBy ?? 'createdAt';
    if (resolvedSortBy !== 'relevance') {
      const column = SORT_COLUMN_MAP[resolvedSortBy] ?? 'product.created_at';
      qb.addOrderBy(column, filters.sortOrder);
    }
    // Stable tie-breaker so pagination never skips/duplicates rows across
    // pages when the primary sort column has ties.
    qb.addOrderBy('product.id', 'ASC');

    qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

    return qb.getManyAndCount();
  }

  async findFeatured(limit: number): Promise<ProductEntity[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.is_active = :isActive', { isActive: true })
      .andWhere('product.is_featured = :isFeatured', { isFeatured: true })
      .orderBy('product.featured_order', 'ASC')
      .addOrderBy('product.updated_at', 'DESC')
      .addOrderBy('product.id', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Distinct product names whose name starts with `prefix` (prefix match only — cheap and predictable, unlike a full substring scan). */
  async findSuggestionNames(prefix: string, limit: number): Promise<string[]> {
    const escaped = escapeLikePattern(prefix);
    const rows: { name: string }[] = await this.repository
      .createQueryBuilder('product')
      .select('DISTINCT product.name', 'name')
      .where('product.is_active = :isActive', { isActive: true })
      .andWhere("product.name ILIKE :prefixPattern ESCAPE '\\'", {
        prefixPattern: `${escaped}%`,
      })
      .orderBy('product.name', 'ASC')
      .take(limit)
      .getRawMany();
    return rows.map((row) => row.name);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}
