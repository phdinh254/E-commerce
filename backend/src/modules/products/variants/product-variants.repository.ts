import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { ProductVariantOptionValueEntity } from './entities/product-variant-option-value.entity';
import { ProductVariantChangeLogEntity } from './entities/product-variant-change-log.entity';
import { ProductOptionEntity } from './entities/product-option.entity';
import { ProductOptionValueEntity } from './entities/product-option-value.entity';
import { VariantChangeType } from './enums/variant-change-type.enum';

export interface CreateVariantOptionValue {
  optionValueId: string;
  optionId: string;
}

export interface VariantWithOptionValues {
  variant: ProductVariantEntity;
  optionValues: {
    optionId: string;
    optionName: string;
    valueId: string;
    value: string;
  }[];
}

export interface UpdateVariantParams {
  productId: string;
  variantId: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
  reason: string;
  actorUserId: string;
}

export type UpdateVariantOutcome =
  | { kind: 'not_found' }
  | { kind: 'ok'; variant: ProductVariantEntity; changed: boolean };

@Injectable()
export class ProductVariantsRepository {
  constructor(
    @InjectRepository(ProductVariantEntity)
    private readonly variantsRepository: Repository<ProductVariantEntity>,
    @InjectRepository(ProductVariantOptionValueEntity)
    private readonly joinRepository: Repository<ProductVariantOptionValueEntity>,
    @InjectRepository(ProductOptionEntity)
    private readonly optionsRepository: Repository<ProductOptionEntity>,
    @InjectRepository(ProductOptionValueEntity)
    private readonly optionValuesRepository: Repository<ProductOptionValueEntity>,
    @InjectRepository(ProductVariantChangeLogEntity)
    private readonly changeLogsRepository: Repository<ProductVariantChangeLogEntity>,
  ) {}

  findById(id: string): Promise<ProductVariantEntity | null> {
    return this.variantsRepository.findOne({ where: { id } });
  }

  /**
   * Inserts the variant row and its option-value join rows in one
   * transaction — a failure inserting any join row rolls back the variant
   * row too, so a variant is never left committed with a partial/missing
   * combination.
   */
  async createWithOptionValues(data: {
    productId: string;
    sku: string;
    combinationKey: string;
    price: number;
    stock: number;
    isActive: boolean;
    optionValues: CreateVariantOptionValue[];
  }): Promise<ProductVariantEntity> {
    return this.variantsRepository.manager.transaction(async (manager) => {
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const joinRepo = manager.getRepository(ProductVariantOptionValueEntity);

      const variant = await variantRepo.save(
        variantRepo.create({
          productId: data.productId,
          sku: data.sku,
          combinationKey: data.combinationKey,
          price: data.price,
          stock: data.stock,
          isActive: data.isActive,
        }),
      );

      await joinRepo.save(
        data.optionValues.map((ov) =>
          joinRepo.create({
            variantId: variant.id,
            optionValueId: ov.optionValueId,
            optionId: ov.optionId,
          }),
        ),
      );

      return variant;
    });
  }

  async findManyWithOptionValues(
    productId: string,
    activeOnly: boolean,
  ): Promise<VariantWithOptionValues[]> {
    const variants = await this.variantsRepository.find({
      where: activeOnly ? { productId, isActive: true } : { productId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (variants.length === 0) return [];

    const variantIds = variants.map((v) => v.id);
    const joinRows = await this.joinRepository.find({
      where: { variantId: In(variantIds) },
    });

    const optionValueIds = [...new Set(joinRows.map((j) => j.optionValueId))];
    const optionIds = [...new Set(joinRows.map((j) => j.optionId))];

    const [values, options] = await Promise.all([
      optionValueIds.length
        ? this.optionValuesRepository.find({
            where: { id: In(optionValueIds) },
          })
        : Promise.resolve([]),
      optionIds.length
        ? this.optionsRepository.find({ where: { id: In(optionIds) } })
        : Promise.resolve([]),
    ]);
    const valueById = new Map(values.map((v) => [v.id, v]));
    const optionById = new Map(options.map((o) => [o.id, o]));

    const joinsByVariant = new Map<string, ProductVariantOptionValueEntity[]>();
    for (const row of joinRows) {
      const bucket = joinsByVariant.get(row.variantId) ?? [];
      bucket.push(row);
      joinsByVariant.set(row.variantId, bucket);
    }

    return variants.map((variant) => {
      const rows = joinsByVariant.get(variant.id) ?? [];
      const optionValues = rows
        .map((row) => {
          const option = optionById.get(row.optionId);
          const value = valueById.get(row.optionValueId);
          return {
            optionId: row.optionId,
            optionName: option?.name ?? '',
            optionDisplayOrder: option?.displayOrder ?? 0,
            valueId: row.optionValueId,
            value: value?.value ?? '',
          };
        })
        .sort(
          (a, b) =>
            a.optionDisplayOrder - b.optionDisplayOrder ||
            a.optionId.localeCompare(b.optionId),
        )
        .map(({ optionId, optionName, valueId, value }) => ({
          optionId,
          optionName,
          valueId,
          value,
        }));

      return { variant, optionValues };
    });
  }

  /**
   * Locks the variant row (pessimistic write, inside a transaction),
   * applies the requested changes, and writes up to two immutable audit
   * rows (PRICE / STOCK) — all in the same transaction. If the audit
   * insert fails, the variant save rolls back with it (both happen inside
   * one `manager.transaction` block, so there is no window where the
   * mutation is committed but the audit insert has not run yet).
   */
  async updatePriceAndStock(
    params: UpdateVariantParams,
  ): Promise<UpdateVariantOutcome> {
    return this.variantsRepository.manager.transaction(async (manager) => {
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const logRepo = manager.getRepository(ProductVariantChangeLogEntity);

      const variant = await variantRepo.findOne({
        where: { id: params.variantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!variant || variant.productId !== params.productId) {
        return { kind: 'not_found' };
      }

      const mutationId = randomUUID();
      const logs: Partial<ProductVariantChangeLogEntity>[] = [];

      if (params.price !== undefined && params.price !== variant.price) {
        logs.push({
          productId: params.productId,
          variantId: variant.id,
          changeType: VariantChangeType.PRICE,
          oldValue: variant.price,
          newValue: params.price,
          delta: params.price - variant.price,
          reason: params.reason,
          actorUserId: params.actorUserId,
          mutationId,
        });
        variant.price = params.price;
      }

      if (params.stock !== undefined && params.stock !== variant.stock) {
        logs.push({
          productId: params.productId,
          variantId: variant.id,
          changeType: VariantChangeType.STOCK,
          oldValue: variant.stock,
          newValue: params.stock,
          delta: params.stock - variant.stock,
          reason: params.reason,
          actorUserId: params.actorUserId,
          mutationId,
        });
        variant.stock = params.stock;
      }

      if (params.isActive !== undefined) {
        variant.isActive = params.isActive;
      }

      if (logs.length > 0 || params.isActive !== undefined) {
        await variantRepo.save(variant);
      }
      if (logs.length > 0) {
        await logRepo.insert(logs);
      }

      return { kind: 'ok', variant, changed: logs.length > 0 };
    });
  }

  async findAuditLogs(filters: {
    productId: string;
    variantId: string;
    page: number;
    limit: number;
    type?: VariantChangeType;
    from?: Date;
    to?: Date;
  }): Promise<[ProductVariantChangeLogEntity[], number]> {
    const qb = this.changeLogsRepository
      .createQueryBuilder('log')
      .where('log.product_id = :productId', { productId: filters.productId })
      .andWhere('log.variant_id = :variantId', {
        variantId: filters.variantId,
      });

    if (filters.type) {
      qb.andWhere('log.change_type = :type', { type: filters.type });
    }
    if (filters.from) {
      qb.andWhere('log.created_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('log.created_at <= :to', { to: filters.to });
    }

    qb.orderBy('log.created_at', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    return qb.getManyAndCount();
  }
}
