import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductOptionsRepository } from './product-options.repository';
import { CreateProductOptionDto } from './dto/create-product-option.dto';
import { CreateOptionValueDto } from './dto/create-option-value.dto';
import {
  ProductOptionResponseDto,
  ProductOptionValueResponseDto,
} from './dto/product-option-response.dto';
import { ProductOptionEntity } from './entities/product-option.entity';
import { ProductOptionValueEntity } from './entities/product-option-value.entity';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';
import { ProductsService } from '../products.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ProductOptionsService {
  constructor(
    private readonly optionsRepository: ProductOptionsRepository,
    private readonly productsService: ProductsService,
  ) {}

  async createOption(
    productId: string,
    dto: CreateProductOptionDto,
  ): Promise<ProductOptionResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    await this.assertNoExistingVariants(productId);

    const name = dto.name.trim();
    const normalizedName = normalizeLabel(name);
    const values = dto.values.map((v) => ({
      value: v.value.trim(),
      normalizedValue: normalizeLabel(v.value),
      displayOrder: v.displayOrder ?? 0,
    }));
    this.assertNoDuplicateNormalizedValues(
      values.map((v) => v.normalizedValue),
    );

    const option = await this.createOrThrowOnDuplicate(() =>
      this.optionsRepository.createOptionWithValues({
        productId,
        name,
        normalizedName,
        displayOrder: dto.displayOrder ?? 0,
        values,
      }),
    );

    return this.toResponse(option, option.values);
  }

  async addValue(
    productId: string,
    optionId: string,
    dto: CreateOptionValueDto,
  ): Promise<ProductOptionValueResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    const option = await this.getOptionOwnedByProductOrThrow(
      productId,
      optionId,
    );

    const value = dto.value.trim();
    const normalizedValue = normalizeLabel(value);

    const created = await this.createOrThrowOnDuplicate(() =>
      this.optionsRepository.addValue({
        optionId: option.id,
        value,
        normalizedValue,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );

    return {
      id: created.id,
      value: created.value,
      displayOrder: created.displayOrder,
    };
  }

  async listOptions(productId: string): Promise<ProductOptionResponseDto[]> {
    await this.productsService.getPublicOrThrow(productId);
    return this.listOptionsForProduct(productId);
  }

  /** Used internally by ProductVariantsService — bypasses the public
   * isActive check since variant creation is an admin-only operation on
   * products that may still be inactive. */
  async listOptionsForProduct(
    productId: string,
  ): Promise<ProductOptionResponseDto[]> {
    const options = await this.optionsRepository.findByProductId(productId);
    if (options.length === 0) return [];

    const values = await this.optionsRepository.findValuesByOptionIds(
      options.map((o) => o.id),
    );
    const valuesByOption = new Map<string, ProductOptionValueEntity[]>();
    for (const value of values) {
      const bucket = valuesByOption.get(value.optionId) ?? [];
      bucket.push(value);
      valuesByOption.set(value.optionId, bucket);
    }

    return options.map((option) =>
      this.toResponse(option, valuesByOption.get(option.id) ?? []),
    );
  }

  private async getOptionOwnedByProductOrThrow(
    productId: string,
    optionId: string,
  ): Promise<ProductOptionEntity> {
    const option = await this.optionsRepository.findOptionById(optionId);
    if (!option || option.productId !== productId) {
      throw new NotFoundException({
        code: 'PRODUCT_OPTION_NOT_FOUND',
        message: 'Không tìm thấy option của sản phẩm này',
      });
    }
    return option;
  }

  private async assertNoExistingVariants(productId: string): Promise<void> {
    const variantCount =
      await this.optionsRepository.countVariantsByProductId(productId);
    if (variantCount > 0) {
      throw new ConflictException({
        code: 'PRODUCT_OPTION_LOCKED_BY_EXISTING_VARIANTS',
        message:
          'Không thể thêm option mới vì sản phẩm đã có biến thể. Hãy thêm value vào option hiện có thay vì tạo option mới.',
      });
    }
  }

  private assertNoDuplicateNormalizedValues(normalized: string[]): void {
    const seen = new Set<string>();
    for (const value of normalized) {
      if (seen.has(value)) {
        throw new ConflictException({
          code: 'PRODUCT_OPTION_VALUE_DUPLICATE_IN_REQUEST',
          message: 'Danh sách value chứa giá trị trùng lặp sau khi chuẩn hóa',
        });
      }
      seen.add(value);
    }
  }

  private async createOrThrowOnDuplicate<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PRODUCT_OPTION_OR_VALUE_ALREADY_EXISTS',
          message: 'Tên option hoặc value đã tồn tại trong sản phẩm này',
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

  private toResponse(
    option: ProductOptionEntity,
    values: ProductOptionValueEntity[],
  ): ProductOptionResponseDto {
    return {
      id: option.id,
      name: option.name,
      displayOrder: option.displayOrder,
      values: values
        .slice()
        .sort(
          (a, b) =>
            a.displayOrder - b.displayOrder ||
            a.value.localeCompare(b.value) ||
            a.id.localeCompare(b.id),
        )
        .map((v) => ({
          id: v.id,
          value: v.value,
          displayOrder: v.displayOrder,
        })),
    };
  }
}
