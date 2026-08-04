import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CategoriesRepository } from './categories.repository';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import {
  CategoryResponseDto,
  PaginatedCategoryResponseDto,
} from './dto/category-response.dto';
import { slugify } from '../../common/utils/slug.util';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const name = dto.name.trim();
    const slug = dto.slug ?? slugify(name);
    this.assertNonEmptySlug(slug);

    if (dto.parentId) {
      await this.assertParentExists(dto.parentId);
    }

    const entity = this.categoriesRepository.create({
      name,
      slug,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      parentId: dto.parentId ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.saveOrThrowOnDuplicateSlug(entity);
    return this.toResponse(saved);
  }

  async findAllActive(
    query: QueryCategoryDto,
  ): Promise<PaginatedCategoryResponseDto> {
    const [items, total] = await this.categoriesRepository.findMany({
      page: query.page,
      limit: query.limit,
      search: query.search,
      parentId: query.parentId,
      activeOnly: true,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: items.map((item) => this.toResponse(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findActiveById(id: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id);
    if (!category || !category.isActive) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Không tìm thấy danh mục',
      });
    }
    return this.toResponse(category);
  }

  async findActiveBySlug(slug: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findBySlug(slug);
    if (!category || !category.isActive) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Không tìm thấy danh mục',
      });
    }
    return this.toResponse(category);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.getExistingOrThrow(id);

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.slug !== undefined) {
      this.assertNonEmptySlug(dto.slug);
      category.slug = dto.slug;
    }
    if (dto.description !== undefined) {
      category.description = dto.description;
    }
    if (dto.imageUrl !== undefined) {
      category.imageUrl = dto.imageUrl;
    }
    if (dto.displayOrder !== undefined) {
      category.displayOrder = dto.displayOrder;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }
    if (dto.parentId !== undefined) {
      await this.assertValidNewParent(id, dto.parentId);
      category.parentId = dto.parentId;
    }

    const saved = await this.saveOrThrowOnDuplicateSlug(category);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    await this.getExistingOrThrow(id);

    const childrenCount = await this.categoriesRepository.countChildren(id);
    if (childrenCount > 0) {
      throw new ConflictException({
        code: 'CATEGORY_HAS_CHILDREN',
        message:
          'Không thể xóa danh mục còn danh mục con. Hãy xóa hoặc chuyển danh mục con trước.',
      });
    }

    await this.categoriesRepository.softDelete(id);
  }

  private async getExistingOrThrow(id: string): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Không tìm thấy danh mục',
      });
    }
    return category;
  }

  private assertNonEmptySlug(slug: string): void {
    if (!slug) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message: 'Không thể tạo slug hợp lệ từ dữ liệu đã cung cấp',
      });
    }
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.categoriesRepository.findById(parentId);
    if (!parent) {
      throw new BadRequestException({
        code: 'PARENT_CATEGORY_NOT_FOUND',
        message: 'Danh mục cha không tồn tại hoặc đã bị xóa',
      });
    }
  }

  private async assertValidNewParent(
    categoryId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (newParentId === null) {
      return;
    }
    if (newParentId === categoryId) {
      throw new BadRequestException({
        code: 'CATEGORY_SELF_PARENT',
        message: 'Danh mục không thể là cha của chính nó',
      });
    }
    await this.assertParentExists(newParentId);

    const ancestorChain =
      await this.categoriesRepository.findParentChain(newParentId);
    if (ancestorChain.includes(categoryId)) {
      throw new BadRequestException({
        code: 'CATEGORY_PARENT_CYCLE',
        message: 'Không thể đặt danh mục con làm cha (tạo vòng lặp)',
      });
    }
  }

  private async saveOrThrowOnDuplicateSlug(
    entity: CategoryEntity,
  ): Promise<CategoryEntity> {
    try {
      return await this.categoriesRepository.save(entity);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'CATEGORY_SLUG_ALREADY_EXISTS',
          message: 'Slug danh mục đã tồn tại',
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

  private toResponse(category: CategoryEntity): CategoryResponseDto {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
