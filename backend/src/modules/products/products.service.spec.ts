import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { ProductEntity } from './entities/product.entity';
import { CategoriesService } from '../categories/categories.service';
import { ProductsCacheService } from './cache/products-cache.service';

function buildProduct(overrides: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id: 'prod-1',
    categoryId: 'cat-1',
    category: null as unknown as ProductEntity['category'],
    name: 'Áo thun nam',
    slug: 'ao-thun-nam',
    sku: 'ATN-001',
    shortDescription: null,
    description: null,
    price: 199000,
    thumbnailUrl: null,
    isActive: true,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildUniqueViolation(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { code: string }).code = '23505';
  return error;
}

const CATEGORY_REF = { id: 'cat-1', name: 'Thời trang', slug: 'thoi-trang' };

describe('ProductsService', () => {
  let repository: jest.Mocked<
    Pick<
      ProductsRepository,
      | 'create'
      | 'save'
      | 'findById'
      | 'findBySlug'
      | 'findMany'
      | 'findFeatured'
      | 'findSuggestionNames'
      | 'softDelete'
    >
  >;
  let categoriesService: jest.Mocked<Pick<CategoriesService, 'findRef'>>;
  let cacheService: jest.Mocked<
    Pick<
      ProductsCacheService,
      | 'buildSearchKey'
      | 'getSearch'
      | 'setSearch'
      | 'buildFeaturedKey'
      | 'getFeatured'
      | 'setFeatured'
      | 'invalidateSearch'
      | 'invalidateFeatured'
    >
  >;
  let service: ProductsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => data as ProductEntity),
      save: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findMany: jest.fn(),
      findFeatured: jest.fn(),
      findSuggestionNames: jest.fn(),
      softDelete: jest.fn(),
    };
    categoriesService = { findRef: jest.fn() };
    cacheService = {
      buildSearchKey: jest.fn().mockResolvedValue('search-key'),
      getSearch: jest.fn().mockResolvedValue(null),
      setSearch: jest.fn().mockResolvedValue(undefined),
      buildFeaturedKey: jest.fn().mockResolvedValue('featured-key'),
      getFeatured: jest.fn().mockResolvedValue(null),
      setFeatured: jest.fn().mockResolvedValue(undefined),
      invalidateSearch: jest.fn().mockResolvedValue(undefined),
      invalidateFeatured: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProductsService(
      repository as unknown as ProductsRepository,
      categoriesService as unknown as CategoriesService,
      cacheService as unknown as ProductsCacheService,
    );
  });

  describe('create', () => {
    it('trims name and generates slug from it when slug is omitted', async () => {
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);
      repository.save.mockImplementation((entity) =>
        Promise.resolve(buildProduct(entity)),
      );

      const result = await service.create({
        name: '  Áo thun nam  ',
        sku: 'ATN-001',
        price: 100000,
        categoryId: 'cat-1',
      });

      expect(result.name).toBe('Áo thun nam');
      expect(result.slug).toBe('ao-thun-nam');
      expect(result.category).toEqual(CATEGORY_REF);
    });

    it('rejects when the category does not exist or is soft-deleted', async () => {
      categoriesService.findRef.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'X',
          sku: 'SKU-1',
          price: 1000,
          categoryId: 'missing-cat',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects when name produces an empty slug and none was supplied', async () => {
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);
      await expect(
        service.create({
          name: '!!!',
          sku: 'SKU-1',
          price: 1000,
          categoryId: 'cat-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts a unique-slug/sku database violation into 409 Conflict', async () => {
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);
      repository.save.mockRejectedValue(buildUniqueViolation());

      await expect(
        service.create({
          name: 'Trùng',
          sku: 'SKU-DUP',
          price: 1000,
          categoryId: 'cat-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findActiveById', () => {
    it('returns the product with its category when active', async () => {
      repository.findById.mockResolvedValue(buildProduct());
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);

      const result = await service.findActiveById('prod-1');
      expect(result.id).toBe('prod-1');
      expect(result.category).toEqual(CATEGORY_REF);
    });

    it('throws 404 when the product does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findActiveById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when the product is inactive (not visible publicly)', async () => {
      repository.findById.mockResolvedValue(buildProduct({ isActive: false }));
      await expect(service.findActiveById('prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('does not change the slug when only name is updated', async () => {
      repository.findById.mockResolvedValue(buildProduct());
      repository.save.mockImplementation((entity) => Promise.resolve(entity));
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);

      const result = await service.update('prod-1', {
        name: 'Áo thun nam mới',
      });

      expect(result.name).toBe('Áo thun nam mới');
      expect(result.slug).toBe('ao-thun-nam');
    });

    it('throws 404 when updating a non-existent product', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('validates the new category when categoryId changes', async () => {
      repository.findById.mockResolvedValue(buildProduct());
      categoriesService.findRef.mockResolvedValue(null);

      await expect(
        service.update('prod-1', { categoryId: 'missing-cat' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts a unique-slug/sku database violation into 409 Conflict', async () => {
      repository.findById.mockResolvedValue(buildProduct());
      repository.save.mockRejectedValue(buildUniqueViolation());

      await expect(
        service.update('prod-1', { slug: 'trung-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing product', async () => {
      repository.findById.mockResolvedValue(buildProduct());
      await service.remove('prod-1');
      expect(repository.softDelete).toHaveBeenCalledWith('prod-1');
    });

    it('throws 404 when the product does not exist or is already deleted', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllActive', () => {
    it('always scopes the list query to active products only', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.findAllActive({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      } as never);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ activeOnly: true }),
      );
    });

    it('computes pagination metadata from total and limit', async () => {
      repository.findMany.mockResolvedValue([
        [buildProduct(), buildProduct({ id: 'prod-2' })],
        45,
      ]);
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);

      const result = await service.findAllActive({
        page: 2,
        limit: 20,
        sortOrder: 'DESC',
      } as never);

      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
      expect(result.items).toHaveLength(2);
    });

    it('passes minPrice/maxPrice through to the repository', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.findAllActive({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
        minPrice: 100000,
        maxPrice: 500000,
      } as never);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ minPrice: 100000, maxPrice: 500000 }),
      );
    });

    it('rejects minPrice greater than maxPrice (400) without querying the repository', async () => {
      await expect(
        service.findAllActive({
          page: 1,
          limit: 20,
          sortOrder: 'DESC',
          minPrice: 500000,
          maxPrice: 100000,
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('allows minPrice equal to maxPrice', async () => {
      repository.findMany.mockResolvedValue([[], 0]);
      await expect(
        service.findAllActive({
          page: 1,
          limit: 20,
          sortOrder: 'DESC',
          minPrice: 200000,
          maxPrice: 200000,
        } as never),
      ).resolves.toBeDefined();
    });
  });

  describe('suggest', () => {
    it('deduplicates suggestion names', async () => {
      repository.findSuggestionNames.mockResolvedValue(['Áo thun', 'Áo thun']);
      const result = await service.suggest({ q: 'áo', limit: 5 });
      expect(result).toEqual(['Áo thun']);
    });
  });

  describe('findFeatured', () => {
    it('returns a slim projection with category', async () => {
      repository.findFeatured.mockResolvedValue([
        buildProduct({ isFeatured: true }),
      ]);
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);

      const result = await service.findFeatured({ limit: 8 });
      expect(result).toEqual([
        {
          id: 'prod-1',
          name: 'Áo thun nam',
          slug: 'ao-thun-nam',
          price: 199000,
          thumbnailUrl: null,
          shortDescription: null,
          category: CATEGORY_REF,
        },
      ]);
    });
  });

  describe('search cache', () => {
    it('returns the cached result without querying the repository on a cache hit', async () => {
      const cached = {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      cacheService.getSearch.mockResolvedValue(cached);

      const result = await service.findAllActive({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      } as never);

      expect(result).toBe(cached);
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('queries the repository and populates the cache on a miss', async () => {
      cacheService.getSearch.mockResolvedValue(null);
      repository.findMany.mockResolvedValue([[], 0]);

      await service.findAllActive({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      } as never);

      expect(repository.findMany).toHaveBeenCalled();
      expect(cacheService.setSearch).toHaveBeenCalledWith(
        'search-key',
        expect.objectContaining({
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      );
    });
  });

  describe('featured cache', () => {
    it('returns the cached result without querying the repository on a cache hit', async () => {
      const cached = [{ id: 'prod-1' }] as never;
      cacheService.getFeatured.mockResolvedValue(cached);

      const result = await service.findFeatured({ limit: 8 });

      expect(result).toBe(cached);
      expect(repository.findFeatured).not.toHaveBeenCalled();
    });

    it('queries the repository and populates the cache on a miss', async () => {
      cacheService.getFeatured.mockResolvedValue(null);
      repository.findFeatured.mockResolvedValue([]);

      await service.findFeatured({ limit: 8 });

      expect(repository.findFeatured).toHaveBeenCalled();
      expect(cacheService.setFeatured).toHaveBeenCalledWith('featured-key', []);
    });
  });

  describe('cache invalidation', () => {
    it('create() always invalidates search, and invalidates featured only when created featured', async () => {
      categoriesService.findRef.mockResolvedValue(CATEGORY_REF);
      repository.save.mockImplementation((entity) =>
        Promise.resolve(buildProduct(entity)),
      );

      await service.create({
        name: 'Không nổi bật',
        sku: 'SKU-A',
        price: 1000,
        categoryId: 'cat-1',
      });
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(1);
      expect(cacheService.invalidateFeatured).not.toHaveBeenCalled();

      await service.create({
        name: 'Nổi bật',
        sku: 'SKU-B',
        price: 1000,
        categoryId: 'cat-1',
        isFeatured: true,
      });
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(2);
      expect(cacheService.invalidateFeatured).toHaveBeenCalledTimes(1);
    });

    it('update() invalidates featured when isFeatured is toggled on', async () => {
      repository.findById.mockResolvedValue(
        buildProduct({ isFeatured: false }),
      );
      repository.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update('prod-1', { isFeatured: true });
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(1);
      expect(cacheService.invalidateFeatured).toHaveBeenCalledTimes(1);
    });

    it('update() invalidates featured when a displayed field of an already-featured product changes', async () => {
      repository.findById.mockResolvedValue(buildProduct({ isFeatured: true }));
      repository.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update('prod-1', { price: 50000 });
      expect(cacheService.invalidateFeatured).toHaveBeenCalledTimes(1);
    });

    it('update() does not invalidate featured when a non-featured product has a non-display field changed', async () => {
      repository.findById.mockResolvedValue(
        buildProduct({ isFeatured: false }),
      );
      repository.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update('prod-1', { description: 'mô tả mới' });
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(1);
      expect(cacheService.invalidateFeatured).not.toHaveBeenCalled();
    });

    it('remove() invalidates featured only when the deleted product was featured', async () => {
      repository.findById.mockResolvedValue(buildProduct({ isFeatured: true }));
      await service.remove('prod-1');
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(1);
      expect(cacheService.invalidateFeatured).toHaveBeenCalledTimes(1);
    });

    it('remove() does not invalidate featured for a non-featured product', async () => {
      repository.findById.mockResolvedValue(
        buildProduct({ isFeatured: false }),
      );
      await service.remove('prod-1');
      expect(cacheService.invalidateSearch).toHaveBeenCalledTimes(1);
      expect(cacheService.invalidateFeatured).not.toHaveBeenCalled();
    });
  });
});
