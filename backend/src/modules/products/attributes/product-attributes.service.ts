import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductAttributesRepository } from './product-attributes.repository';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { ProductAttributeResponseDto } from './dto/product-attribute-response.dto';
import { ProductAttributeEntity } from './entities/product-attribute.entity';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';
import { ProductsService } from '../products.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ProductAttributesService {
  constructor(
    private readonly attributesRepository: ProductAttributesRepository,
    private readonly productsService: ProductsService,
  ) {}

  async create(
    productId: string,
    dto: CreateProductAttributeDto,
  ): Promise<ProductAttributeResponseDto> {
    await this.productsService.getManageableOrThrow(productId);

    const name = dto.name.trim();
    const entity = this.attributesRepository.create({
      productId,
      name,
      normalizedName: normalizeLabel(name),
      value: dto.value.trim(),
      unit: dto.unit ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isVisible: dto.isVisible ?? true,
    });

    const saved = await this.saveOrThrowOnDuplicate(entity);
    return this.toResponse(saved);
  }

  async list(
    productId: string,
    visibleOnly: boolean,
  ): Promise<ProductAttributeResponseDto[]> {
    const attributes = await this.attributesRepository.findByProductId(
      productId,
      visibleOnly,
    );
    return attributes.map((a) => this.toResponse(a));
  }

  async listPublic(productId: string): Promise<ProductAttributeResponseDto[]> {
    await this.productsService.getPublicOrThrow(productId);
    return this.list(productId, true);
  }

  async listForAdmin(
    productId: string,
  ): Promise<ProductAttributeResponseDto[]> {
    await this.productsService.getManageableOrThrow(productId);
    return this.list(productId, false);
  }

  async update(
    productId: string,
    attributeId: string,
    dto: UpdateProductAttributeDto,
  ): Promise<ProductAttributeResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    const attribute = await this.getOwnedOrThrow(productId, attributeId);

    if (
      dto.name === undefined &&
      dto.value === undefined &&
      dto.unit === undefined &&
      dto.displayOrder === undefined &&
      dto.isVisible === undefined
    ) {
      throw new BadRequestException({
        code: 'EMPTY_ATTRIBUTE_UPDATE',
        message: 'Phải cung cấp ít nhất một trường để cập nhật',
      });
    }

    if (dto.name !== undefined) {
      attribute.name = dto.name.trim();
      attribute.normalizedName = normalizeLabel(dto.name);
    }
    if (dto.value !== undefined) {
      attribute.value = dto.value.trim();
    }
    if (dto.unit !== undefined) {
      attribute.unit = dto.unit;
    }
    if (dto.displayOrder !== undefined) {
      attribute.displayOrder = dto.displayOrder;
    }
    if (dto.isVisible !== undefined) {
      attribute.isVisible = dto.isVisible;
    }

    const saved = await this.saveOrThrowOnDuplicate(attribute);
    return this.toResponse(saved);
  }

  async remove(productId: string, attributeId: string): Promise<void> {
    await this.productsService.getManageableOrThrow(productId);
    await this.getOwnedOrThrow(productId, attributeId);
    await this.attributesRepository.softDelete(attributeId);
  }

  private async getOwnedOrThrow(
    productId: string,
    attributeId: string,
  ): Promise<ProductAttributeEntity> {
    const attribute = await this.attributesRepository.findById(attributeId);
    if (!attribute || attribute.productId !== productId) {
      throw new NotFoundException({
        code: 'PRODUCT_ATTRIBUTE_NOT_FOUND',
        message: 'Không tìm thấy thuộc tính của sản phẩm này',
      });
    }
    return attribute;
  }

  private async saveOrThrowOnDuplicate(
    entity: ProductAttributeEntity,
  ): Promise<ProductAttributeEntity> {
    try {
      return await this.attributesRepository.save(entity);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PRODUCT_ATTRIBUTE_NAME_ALREADY_EXISTS',
          message: 'Tên thuộc tính đã tồn tại trong sản phẩm này',
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
    attribute: ProductAttributeEntity,
  ): ProductAttributeResponseDto {
    return {
      id: attribute.id,
      name: attribute.name,
      value: attribute.value,
      unit: attribute.unit,
      displayOrder: attribute.displayOrder,
      isVisible: attribute.isVisible,
      createdAt: attribute.createdAt,
      updatedAt: attribute.updatedAt,
    };
  }
}
