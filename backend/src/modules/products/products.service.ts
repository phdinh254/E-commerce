import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductsRepository } from './products.repository';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { SuggestionQueryDto } from './dto/suggestion-query.dto';
import { FeaturedQueryDto } from './dto/featured-query.dto';
import {
  FeaturedProductResponseDto,
  PaginatedProductResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto';
import { slugify } from '../../common/utils/slug.util';
import { CategoriesService } from '../categories/categories.service';
import { ProductsCacheService } from './cache/products-cache.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Fields that, if changed, could change what a cached featured-list entry
 * displays — used to decide whether an update needs to bump the featured
 * cache generation for an already-featured product. */
const FEATURED_DISPLAY_FIELDS = [
  'name',
  'slug',
  'price',
  'thumbnailUrl',
  'shortDescription',
] as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly productsCacheService: ProductsCacheService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const name = dto.name.trim();
    const slug = dto.slug ?? slugify(name);
    this.assertNonEmptySlug(slug);

    const category = await this.categoriesService.findRef(dto.categoryId);
    if (!category) {
      throw new BadRequestException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Danh mục không tồn tại hoặc đã bị xóa',
      });
    }

    const entity = this.productsRepository.create({
      categoryId: dto.categoryId,
      name,
      slug,
      sku: dto.sku,
      shortDescription: dto.shortDescription ?? null,
      description: dto.description ?? null,
      price: dto.price,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      featuredOrder: dto.featuredOrder ?? 0,
    });

    const saved = await this.saveOrThrowOnDuplicate(entity);

    // Invalidation runs only after the write has committed — never before,
    // so a rolled-back/failed write can never invalidate a cache that still
    // correctly reflects the (unchanged) database.
    await this.productsCacheService.invalidateSearch();
    if (saved.isFeatured) {
      await this.productsCacheService.invalidateFeatured();
    }

    return this.toResponse(saved, category);
  }

  async findAllActive(
    query: QueryProductDto,
  ): Promise<PaginatedProductResponseDto> {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRICE_RANGE',
        message: 'minPrice không được lớn hơn maxPrice',
      });
    }

    const cacheKey = await this.productsCacheService.buildSearchKey({
      search: query.search,
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });
    const cached = await this.productsCacheService.getSearch(cacheKey);
    if (cached) {
      return cached;
    }

    const [items, total] = await this.productsRepository.findMany({
      page: query.page,
      limit: query.limit,
      search: query.search,
      categoryId: query.categoryId,
      activeOnly: true,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });

    const responses = await this.toResponseList(items);
    const result: PaginatedProductResponseDto = {
      items: responses,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    await this.productsCacheService.setSearch(cacheKey, result);
    return result;
  }

  async findActiveById(id: string): Promise<ProductResponseDto> {
    const product = await this.productsRepository.findById(id);
    if (!product || !product.isActive) {
      throw this.notFound();
    }
    return this.toResponseWithCategoryLookup(product);
  }

  async findActiveBySlug(slug: string): Promise<ProductResponseDto> {
    const product = await this.productsRepository.findBySlug(slug);
    if (!product || !product.isActive) {
      throw this.notFound();
    }
    return this.toResponseWithCategoryLookup(product);
  }

  async suggest(query: SuggestionQueryDto): Promise<string[]> {
    const names = await this.productsRepository.findSuggestionNames(
      query.q,
      query.limit,
    );
    return [...new Set(names)];
  }

  async findFeatured(
    query: FeaturedQueryDto,
  ): Promise<FeaturedProductResponseDto[]> {
    const cacheKey = await this.productsCacheService.buildFeaturedKey(
      query.limit,
    );
    const cached = await this.productsCacheService.getFeatured(cacheKey);
    if (cached) {
      return cached;
    }

    const items = await this.productsRepository.findFeatured(query.limit);
    const responses = await this.toResponseList(items);
    const result = responses.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      thumbnailUrl: item.thumbnailUrl,
      shortDescription: item.shortDescription,
      category: item.category,
    }));

    await this.productsCacheService.setFeatured(cacheKey, result);
    return result;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.getExistingOrThrow(id);
    const wasFeatured = product.isFeatured;

    if (dto.name !== undefined) {
      product.name = dto.name.trim();
    }
    if (dto.slug !== undefined) {
      this.assertNonEmptySlug(dto.slug);
      product.slug = dto.slug;
    }
    if (dto.sku !== undefined) {
      product.sku = dto.sku;
    }
    if (dto.shortDescription !== undefined) {
      product.shortDescription = dto.shortDescription;
    }
    if (dto.description !== undefined) {
      product.description = dto.description;
    }
    if (dto.price !== undefined) {
      product.price = dto.price;
    }
    if (dto.thumbnailUrl !== undefined) {
      product.thumbnailUrl = dto.thumbnailUrl;
    }
    if (dto.isActive !== undefined) {
      product.isActive = dto.isActive;
    }
    if (dto.isFeatured !== undefined) {
      product.isFeatured = dto.isFeatured;
    }
    if (dto.featuredOrder !== undefined) {
      product.featuredOrder = dto.featuredOrder;
    }
    let category: { id: string; name: string; slug: string } | null = null;
    if (dto.categoryId !== undefined) {
      category = await this.categoriesService.findRef(dto.categoryId);
      if (!category) {
        throw new BadRequestException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Danh mục không tồn tại hoặc đã bị xóa',
        });
      }
      product.categoryId = dto.categoryId;
    }

    const saved = await this.saveOrThrowOnDuplicate(product);

    // Runs only after the write has committed (see create()).
    await this.productsCacheService.invalidateSearch();
    const featuredDisplayChanged = FEATURED_DISPLAY_FIELDS.some(
      (field) => dto[field] !== undefined,
    );
    if (
      wasFeatured !== saved.isFeatured ||
      (saved.isFeatured && featuredDisplayChanged)
    ) {
      await this.productsCacheService.invalidateFeatured();
    }

    return category
      ? this.toResponse(saved, category)
      : this.toResponseWithCategoryLookup(saved);
  }

  async remove(id: string): Promise<void> {
    const product = await this.getExistingOrThrow(id);
    await this.productsRepository.softDelete(id);

    // Runs only after the write has committed (see create()).
    await this.productsCacheService.invalidateSearch();
    if (product.isFeatured) {
      await this.productsCacheService.invalidateFeatured();
    }
  }

  /**
   * For same-module sub-resources (options/variants/attributes — Chapter
   * 10): the product must exist and not be soft-deleted, but may be
   * inactive (an admin configures variants before flipping a product
   * live). Returns the raw entity — acceptable for same-module reuse,
   * unlike CategoriesService.findRef()'s projection, which crosses a
   * module boundary.
   */
  async getManageableOrThrow(id: string): Promise<ProductEntity> {
    return this.getExistingOrThrow(id);
  }

  /** For public sub-resource reads: the product must be active and not deleted. */
  async getPublicOrThrow(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(id);
    if (!product || !product.isActive) {
      throw this.notFound();
    }
    return product;
  }

  private async getExistingOrThrow(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw this.notFound();
    }
    return product;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Không tìm thấy sản phẩm',
    });
  }

  private assertNonEmptySlug(slug: string): void {
    if (!slug) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message: 'Không thể tạo slug hợp lệ từ dữ liệu đã cung cấp',
      });
    }
  }

  private async saveOrThrowOnDuplicate(
    entity: ProductEntity,
  ): Promise<ProductEntity> {
    try {
      return await this.productsRepository.save(entity);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PRODUCT_SLUG_OR_SKU_ALREADY_EXISTS',
          message: 'Slug hoặc SKU sản phẩm đã tồn tại',
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

  private async toResponseWithCategoryLookup(
    product: ProductEntity,
  ): Promise<ProductResponseDto> {
    const category = await this.categoriesService.findRef(product.categoryId);
    return this.toResponse(product, category);
  }

  private async toResponseList(
    products: ProductEntity[],
  ): Promise<ProductResponseDto[]> {
    const uniqueCategoryIds = [...new Set(products.map((p) => p.categoryId))];
    const categoryEntries = await Promise.all(
      uniqueCategoryIds.map(
        async (id) => [id, await this.categoriesService.findRef(id)] as const,
      ),
    );
    const categoryMap = new Map(categoryEntries);
    return products.map((product) =>
      this.toResponse(product, categoryMap.get(product.categoryId) ?? null),
    );
  }

  private toResponse(
    product: ProductEntity,
    category: { id: string; name: string; slug: string } | null,
  ): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      thumbnailUrl: product.thumbnailUrl,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      featuredOrder: product.featuredOrder,
      category,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
