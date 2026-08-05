import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { ProductImageEntity } from './entities/product-image.entity';

@Injectable()
export class ProductImagesRepository {
  constructor(
    @InjectRepository(ProductImageEntity)
    private readonly repository: Repository<ProductImageEntity>,
  ) {}

  get manager(): EntityManager {
    return this.repository.manager;
  }

  create(data: Partial<ProductImageEntity>): ProductImageEntity {
    return this.repository.create(data);
  }

  save(image: ProductImageEntity): Promise<ProductImageEntity> {
    return this.repository.save(image);
  }

  /** Insert several rows in one transaction — all-or-nothing (Ch11-B103). */
  async saveMany(
    rows: Partial<ProductImageEntity>[],
  ): Promise<ProductImageEntity[]> {
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ProductImageEntity);
      return repo.save(rows.map((row) => repo.create(row)));
    });
  }

  findById(id: string): Promise<ProductImageEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /** Live (non-soft-deleted) rows for a product, ordered for stable display. */
  findManyByProductId(
    productId: string,
    options: { variantId?: string | null } = {},
  ): Promise<ProductImageEntity[]> {
    return this.repository.find({
      where:
        options.variantId === undefined
          ? { productId }
          : {
              productId,
              variantId:
                options.variantId === null ? IsNull() : options.variantId,
            },
      order: { displayOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  /** Includes soft-deleted rows — for admin/audit reads only, never public. */
  findManyByProductIdIncludingDeleted(
    productId: string,
  ): Promise<ProductImageEntity[]> {
    return this.repository.find({
      where: { productId },
      order: { displayOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
      withDeleted: true,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  async maxDisplayOrder(productId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('image')
      .select('MAX(image.display_order)', 'max')
      .where('image.product_id = :productId', { productId })
      .getRawOne<{ max: string | null }>();
    return row?.max ? parseInt(row.max, 10) : -1;
  }
}
