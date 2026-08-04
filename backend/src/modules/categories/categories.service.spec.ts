import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';
import { CategoryEntity } from './entities/category.entity';

function buildCategory(
  overrides: Partial<CategoryEntity> = {},
): CategoryEntity {
  return {
    id: 'cat-1',
    parentId: null,
    parent: null,
    children: [],
    name: 'Điện thoại',
    slug: 'dien-thoai',
    description: null,
    imageUrl: null,
    displayOrder: 0,
    isActive: true,
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

describe('CategoriesService', () => {
  let repository: jest.Mocked<
    Pick<
      CategoriesRepository,
      | 'create'
      | 'save'
      | 'findById'
      | 'findBySlug'
      | 'countChildren'
      | 'findParentChain'
      | 'findMany'
      | 'softDelete'
    >
  >;
  let service: CategoriesService;

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => data as CategoryEntity),
      save: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      countChildren: jest.fn(),
      findParentChain: jest.fn(),
      findMany: jest.fn(),
      softDelete: jest.fn(),
    };
    service = new CategoriesService(
      repository as unknown as CategoriesRepository,
    );
  });

  describe('create', () => {
    it('trims name and generates slug from it when slug is omitted', async () => {
      repository.save.mockImplementation((entity) =>
        Promise.resolve(buildCategory(entity)),
      );

      const result = await service.create({
        name: '  Điện thoại  ',
      });

      expect(result.name).toBe('Điện thoại');
      expect(result.slug).toBe('dien-thoai');
    });

    it('normalizes a client-suggested slug (already handled by DTO transform, service just stores it)', async () => {
      repository.save.mockImplementation((entity) =>
        Promise.resolve(buildCategory(entity)),
      );

      const result = await service.create({
        name: 'Điện thoại',
        slug: 'custom-slug',
      });

      expect(result.slug).toBe('custom-slug');
    });

    it('rejects when name produces an empty slug and none was supplied', async () => {
      await expect(service.create({ name: '!!!' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('validates the parent exists before creating', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Con', parentId: 'missing-parent' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts a unique-slug database violation into 409 Conflict', async () => {
      repository.save.mockRejectedValue(buildUniqueViolation());

      await expect(service.create({ name: 'Trùng' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findActiveById', () => {
    it('returns the category when active', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      const result = await service.findActiveById('cat-1');
      expect(result.id).toBe('cat-1');
    });

    it('throws 404 when the category does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findActiveById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when the category is inactive (not visible publicly)', async () => {
      repository.findById.mockResolvedValue(buildCategory({ isActive: false }));
      await expect(service.findActiveById('cat-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('does not change the slug when only name is updated', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      repository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update('cat-1', {
        name: 'Điện thoại di động',
      });

      expect(result.name).toBe('Điện thoại di động');
      expect(result.slug).toBe('dien-thoai');
    });

    it('throws 404 when updating a non-existent category', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects setting a category as its own parent', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      await expect(
        service.update('cat-1', { parentId: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parent change that would create a cycle', async () => {
      repository.findById
        .mockResolvedValueOnce(buildCategory({ id: 'cat-1' }))
        .mockResolvedValueOnce(buildCategory({ id: 'cat-2' }));
      repository.findParentChain.mockResolvedValue(['cat-2', 'cat-1']);

      await expect(
        service.update('cat-1', { parentId: 'cat-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts a unique-slug database violation into 409 Conflict', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      repository.save.mockRejectedValue(buildUniqueViolation());

      await expect(
        service.update('cat-1', { slug: 'trung-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes when the category has no children', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      repository.countChildren.mockResolvedValue(0);

      await service.remove('cat-1');

      expect(repository.softDelete).toHaveBeenCalledWith('cat-1');
    });

    it('rejects deletion when the category still has children (409)', async () => {
      repository.findById.mockResolvedValue(buildCategory());
      repository.countChildren.mockResolvedValue(2);

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('throws 404 when the category does not exist or is already deleted', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllActive', () => {
    it('always scopes the list query to active categories only', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.findAllActive({
        page: 1,
        limit: 20,
        sortBy: 'displayOrder',
        sortOrder: 'ASC',
      } as never);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ activeOnly: true }),
      );
    });

    it('computes pagination metadata from total and limit', async () => {
      repository.findMany.mockResolvedValue([
        [buildCategory(), buildCategory({ id: 'cat-2' })],
        45,
      ]);

      const result = await service.findAllActive({
        page: 2,
        limit: 20,
        sortBy: 'displayOrder',
        sortOrder: 'ASC',
      } as never);

      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
      expect(result.items).toHaveLength(2);
    });
  });
});
