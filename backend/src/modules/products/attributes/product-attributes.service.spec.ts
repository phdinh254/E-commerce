import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductAttributesService } from './product-attributes.service';
import { ProductAttributesRepository } from './product-attributes.repository';
import { ProductsService } from '../products.service';
import { ProductAttributeEntity } from './entities/product-attribute.entity';

function buildAttribute(
  overrides: Partial<ProductAttributeEntity> = {},
): ProductAttributeEntity {
  return {
    id: 'attr-1',
    productId: 'prod-1',
    name: 'Xuất xứ',
    normalizedName: 'xuất xứ',
    value: 'Việt Nam',
    unit: null,
    displayOrder: 0,
    isVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as ProductAttributeEntity;
}

function buildUniqueViolation(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { code: string }).code = '23505';
  return error;
}

describe('ProductAttributesService', () => {
  let repository: jest.Mocked<
    Pick<
      ProductAttributesRepository,
      'create' | 'save' | 'findById' | 'findByProductId' | 'softDelete'
    >
  >;
  let productsService: jest.Mocked<
    Pick<ProductsService, 'getManageableOrThrow' | 'getPublicOrThrow'>
  >;
  let service: ProductAttributesService;

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => data as ProductAttributeEntity),
      save: jest.fn(),
      findById: jest.fn(),
      findByProductId: jest.fn(),
      softDelete: jest.fn(),
    };
    productsService = {
      getManageableOrThrow: jest.fn().mockResolvedValue({ id: 'prod-1' }),
      getPublicOrThrow: jest.fn().mockResolvedValue({ id: 'prod-1' }),
    };
    service = new ProductAttributesService(
      repository as unknown as ProductAttributesRepository,
      productsService as unknown as ProductsService,
    );
  });

  describe('create', () => {
    it('trims name/value and normalizes the name', async () => {
      repository.save.mockImplementation((entity) =>
        Promise.resolve(buildAttribute(entity)),
      );

      const result = await service.create('prod-1', {
        name: '  Xuất xứ  ',
        value: '  Việt Nam  ',
      });

      expect(result.name).toBe('Xuất xứ');
      expect(result.value).toBe('Việt Nam');
    });

    it('converts a unique-name database violation into 409 Conflict', async () => {
      repository.save.mockRejectedValue(buildUniqueViolation());
      await expect(
        service.create('prod-1', {
          name: 'Trùng',
          value: 'X',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('rejects an empty payload (400)', async () => {
      repository.findById.mockResolvedValue(buildAttribute());
      await expect(service.update('prod-1', 'attr-1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 404 when the attribute belongs to a different product', async () => {
      repository.findById.mockResolvedValue(
        buildAttribute({ productId: 'other-product' }),
      );
      await expect(
        service.update('prod-1', 'attr-1', { value: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-normalizes the name when it changes', async () => {
      repository.findById.mockResolvedValue(buildAttribute());
      repository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update('prod-1', 'attr-1', {
        name: 'Chất liệu',
      });

      expect(result.name).toBe('Chất liệu');
    });

    it('converts a unique-name database violation into 409 Conflict', async () => {
      repository.findById.mockResolvedValue(buildAttribute());
      repository.save.mockRejectedValue(buildUniqueViolation());
      await expect(
        service.update('prod-1', 'attr-1', { name: 'Trùng' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes an owned attribute', async () => {
      repository.findById.mockResolvedValue(buildAttribute());
      await service.remove('prod-1', 'attr-1');
      expect(repository.softDelete).toHaveBeenCalledWith('attr-1');
    });

    it('throws 404 for an attribute belonging to a different product', async () => {
      repository.findById.mockResolvedValue(
        buildAttribute({ productId: 'other-product' }),
      );
      await expect(service.remove('prod-1', 'attr-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('listPublic', () => {
    it('only requests visible attributes', async () => {
      repository.findByProductId.mockResolvedValue([]);
      await service.listPublic('prod-1');
      expect(repository.findByProductId).toHaveBeenCalledWith('prod-1', true);
    });
  });
});
