import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductVariantsRepository } from './product-variants.repository';
import { ProductOptionsRepository } from './product-options.repository';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { VariantAuditQueryDto } from './dto/variant-audit-query.dto';
import { ProductVariantResponseDto } from './dto/product-variant-response.dto';
import {
  PaginatedVariantAuditLogResponseDto,
  VariantAuditLogResponseDto,
} from './dto/variant-audit-log-response.dto';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { buildCombinationKey } from './combination-key.util';
import { ProductsService } from '../products.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const SKU_UNIQUE_CONSTRAINT = 'UQ_product_variants_sku_upper';
const COMBINATION_UNIQUE_CONSTRAINT =
  'UQ_product_variants_product_id_combination_key';

@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly variantsRepository: ProductVariantsRepository,
    private readonly optionsRepository: ProductOptionsRepository,
    private readonly productsService: ProductsService,
  ) {}

  async createVariant(
    productId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariantResponseDto> {
    const product = await this.productsService.getManageableOrThrow(productId);

    if (dto.sku === product.sku) {
      throw new BadRequestException({
        code: 'VARIANT_SKU_MATCHES_PARENT_PRODUCT',
        message: 'SKU biến thể không được trùng SKU sản phẩm cha',
      });
    }

    const options = await this.optionsRepository.findByProductId(productId);
    if (options.length === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_HAS_NO_OPTIONS',
        message: 'Sản phẩm chưa có option nào để tạo biến thể',
      });
    }

    const values = await this.optionsRepository.findValuesByIds(
      dto.optionValueIds,
    );
    if (values.length !== dto.optionValueIds.length) {
      throw new BadRequestException({
        code: 'OPTION_VALUE_NOT_FOUND',
        message: 'Một hoặc nhiều optionValueId không tồn tại',
      });
    }

    const optionIdSet = new Set(options.map((o) => o.id));
    for (const value of values) {
      if (!optionIdSet.has(value.optionId)) {
        throw new BadRequestException({
          code: 'OPTION_VALUE_NOT_IN_PRODUCT',
          message:
            'Một hoặc nhiều optionValueId không thuộc option của sản phẩm này',
        });
      }
    }

    const valuesByOption = new Map<string, typeof values>();
    for (const value of values) {
      const bucket = valuesByOption.get(value.optionId) ?? [];
      bucket.push(value);
      valuesByOption.set(value.optionId, bucket);
    }
    for (const bucket of valuesByOption.values()) {
      if (bucket.length > 1) {
        throw new BadRequestException({
          code: 'MULTIPLE_VALUES_SAME_OPTION',
          message: 'Không được chọn hai value thuộc cùng một option',
        });
      }
    }
    if (valuesByOption.size !== options.length) {
      throw new BadRequestException({
        code: 'MISSING_OPTION',
        message: 'Phải chọn đúng một value cho mỗi option của sản phẩm',
      });
    }

    const combinationKey = buildCombinationKey(
      values.map((v) => ({ optionId: v.optionId, optionValueId: v.id })),
    );
    const price = dto.price ?? product.price;
    const stock = dto.stock ?? 0;

    const variant = await this.createOrThrowOnDuplicate(() =>
      this.variantsRepository.createWithOptionValues({
        productId,
        sku: dto.sku,
        combinationKey,
        price,
        stock,
        isActive: dto.isActive ?? true,
        optionValues: values.map((v) => ({
          optionValueId: v.id,
          optionId: v.optionId,
        })),
      }),
    );

    const optionById = new Map(options.map((o) => [o.id, o]));
    const optionValues = values
      .map((v) => ({
        optionId: v.optionId,
        optionDisplayOrder: optionById.get(v.optionId)?.displayOrder ?? 0,
        optionName: optionById.get(v.optionId)?.name ?? '',
        valueId: v.id,
        value: v.value,
      }))
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

    return this.toResponse(variant, optionValues);
  }

  async listVariants(
    productId: string,
    activeOnly: boolean,
  ): Promise<ProductVariantResponseDto[]> {
    const rows = await this.variantsRepository.findManyWithOptionValues(
      productId,
      activeOnly,
    );
    return rows.map((row) => this.toResponse(row.variant, row.optionValues));
  }

  async listPublicVariants(
    productId: string,
  ): Promise<ProductVariantResponseDto[]> {
    await this.productsService.getPublicOrThrow(productId);
    return this.listVariants(productId, true);
  }

  async listVariantsForAdmin(
    productId: string,
  ): Promise<ProductVariantResponseDto[]> {
    await this.productsService.getManageableOrThrow(productId);
    return this.listVariants(productId, false);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
    actorUserId: string,
  ): Promise<ProductVariantResponseDto> {
    await this.productsService.getManageableOrThrow(productId);

    if (
      dto.price === undefined &&
      dto.stock === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException({
        code: 'EMPTY_VARIANT_UPDATE',
        message: 'Phải cung cấp ít nhất một trong price, stock hoặc isActive',
      });
    }

    const outcome = await this.variantsRepository.updatePriceAndStock({
      productId,
      variantId,
      price: dto.price,
      stock: dto.stock,
      isActive: dto.isActive,
      reason: dto.reason,
      actorUserId,
    });

    if (outcome.kind === 'not_found') {
      throw this.variantNotFound();
    }

    const rows = await this.variantsRepository.findManyWithOptionValues(
      productId,
      false,
    );
    const row = rows.find((r) => r.variant.id === variantId);
    return this.toResponse(outcome.variant, row?.optionValues ?? []);
  }

  async getAuditLogs(
    productId: string,
    variantId: string,
    query: VariantAuditQueryDto,
  ): Promise<PaginatedVariantAuditLogResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    const variant = await this.variantsRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw this.variantNotFound();
    }

    const [items, total] = await this.variantsRepository.findAuditLogs({
      productId,
      variantId,
      page: query.page,
      limit: query.limit,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    const responseItems: VariantAuditLogResponseDto[] = items.map((log) => ({
      id: log.id,
      changeType: log.changeType,
      oldValue: log.oldValue,
      newValue: log.newValue,
      delta: log.delta,
      reason: log.reason,
      actorUserId: log.actorUserId,
      mutationId: log.mutationId,
      createdAt: log.createdAt,
    }));

    return {
      items: responseItems,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Raw entity lookup for cross-module callers (Cart) that need
   * price/stock/isActive/productId directly — no response-DTO mapping. */
  findRawById(id: string): Promise<ProductVariantEntity | null> {
    return this.variantsRepository.findById(id);
  }

  /** Batched option-value labels for many variant ids at once — used by
   * Cart to avoid one query per cart line. See
   * ProductVariantsRepository.findManyByIdsWithOptionValues. */
  findManyByIdsWithOptionValues(variantIds: string[]): Promise<
    {
      variant: ProductVariantEntity;
      optionValues: {
        optionId: string;
        optionName: string;
        valueId: string;
        value: string;
      }[];
    }[]
  > {
    return this.variantsRepository.findManyByIdsWithOptionValues(variantIds);
  }

  private variantNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_VARIANT_NOT_FOUND',
      message: 'Không tìm thấy biến thể của sản phẩm này',
    });
  }

  private async createOrThrowOnDuplicate(
    op: () => Promise<ProductVariantEntity>,
  ): Promise<ProductVariantEntity> {
    try {
      return await op();
    } catch (error) {
      if (this.isUniqueViolationOn(error, SKU_UNIQUE_CONSTRAINT)) {
        throw new ConflictException({
          code: 'PRODUCT_VARIANT_SKU_ALREADY_EXISTS',
          message: 'SKU biến thể đã tồn tại',
        });
      }
      if (this.isUniqueViolationOn(error, COMBINATION_UNIQUE_CONSTRAINT)) {
        throw new ConflictException({
          code: 'PRODUCT_VARIANT_COMBINATION_ALREADY_EXISTS',
          message: 'Tổ hợp option value này đã có biến thể',
        });
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PRODUCT_VARIANT_ALREADY_EXISTS',
          message: 'SKU hoặc tổ hợp biến thể đã tồn tại',
        });
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private isUniqueViolationOn(error: unknown, constraint: string): boolean {
    return (
      this.isUniqueViolation(error) &&
      (error as { constraint?: string }).constraint === constraint
    );
  }

  private toResponse(
    variant: ProductVariantEntity,
    optionValues: {
      optionId: string;
      optionName: string;
      valueId: string;
      value: string;
    }[],
  ): ProductVariantResponseDto {
    return {
      id: variant.id,
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock,
      isActive: variant.isActive,
      optionValues,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
