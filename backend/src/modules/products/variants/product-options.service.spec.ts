import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductOptionsService } from './product-options.service';
import { ProductOptionsRepository } from './product-options.repository';
import { ProductsService } from '../products.service';
import { ProductOptionEntity } from './entities/product-option.entity';
import { ProductOptionValueEntity } from './entities/product-option-value.entity';
import { ProductEntity } from '../entities/product.entity';

function buildProduct(): ProductEntity {
  return { id: 'prod-1', sku: 'PARENT-SKU' } as ProductEntity;
}

function buildOption(
  overrides: Partial<ProductOptionEntity> = {},
): ProductOptionEntity {
  return {
    id: 'opt-1',
    productId: 'prod-1',
    name: 'Màu sắc',
    normalizedName: 'màu sắc',
    displayOrder: 0,
    values: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductOptionEntity;
}

function buildUniqueViolation(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { code: string }).code = '23505';
  return error;
}

describe('ProductOptionsService', () => {
  let repository: jest.Mocked<
    Pick<
      ProductOptionsRepository,
      | 'countVariantsByProductId'
      | 'findByProductId'
      | 'findValuesByOptionIds'
      | 'findOptionById'
      | 'createOptionWithValues'
      | 'addValue'
    >
  >;
  let productsService: jest.Mocked<
    Pick<ProductsService, 'getManageableOrThrow' | 'getPublicOrThrow'>
  >;
  let service: ProductOptionsService;

  beforeEach(() => {
    repository = {
      countVariantsByProductId: jest.fn().mockResolvedValue(0),
      findByProductId: jest.fn(),
      findValuesByOptionIds: jest.fn(),
      findOptionById: jest.fn(),
      createOptionWithValues: jest.fn(),
      addValue: jest.fn(),
    };
    productsService = {
      getManageableOrThrow: jest.fn().mockResolvedValue(buildProduct()),
      getPublicOrThrow: jest.fn().mockResolvedValue(buildProduct()),
    };
    service = new ProductOptionsService(
      repository as unknown as ProductOptionsRepository,
      productsService as unknown as ProductsService,
    );
  });

  describe('createOption', () => {
    it('trims and normalizes the option name and each value', async () => {
      repository.createOptionWithValues.mockImplementation((data) =>
        Promise.resolve(
          buildOption({
            name: data.name,
            normalizedName: data.normalizedName,
            values: data.values.map((v, i) => ({
              id: `val-${i}`,
              ...v,
            })) as ProductOptionValueEntity[],
          }),
        ),
      );

      const result = await service.createOption('prod-1', {
        name: '  Màu sắc  ',
        values: [{ value: '  Đỏ  ' }, { value: 'Xanh' }],
      });

      expect(result.name).toBe('Màu sắc');
      expect(result.values.map((v) => v.value)).toEqual(['Đỏ', 'Xanh']);
    });

    it('rejects when the product already has at least one variant (409)', async () => {
      repository.countVariantsByProductId.mockResolvedValue(1);

      await expect(
        service.createOption('prod-1', {
          name: 'Kích thước',
          values: [{ value: 'M' }],
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.createOptionWithValues).not.toHaveBeenCalled();
    });

    it('rejects duplicate values within the same request after normalization (409)', async () => {
      await expect(
        service.createOption('prod-1', {
          name: 'Màu sắc',
          values: [{ value: 'Đỏ' }, { value: '  đỏ  ' }],
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.createOptionWithValues).not.toHaveBeenCalled();
    });

    it('converts a unique-name/value database violation into 409 Conflict', async () => {
      repository.createOptionWithValues.mockRejectedValue(
        buildUniqueViolation(),
      );

      await expect(
        service.createOption('prod-1', {
          name: 'Trùng',
          values: [{ value: 'X' }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('addValue', () => {
    it('rejects when the option does not belong to the product in the URL', async () => {
      repository.findOptionById.mockResolvedValue(
        buildOption({ productId: 'other-product' }),
      );

      await expect(
        service.addValue('prod-1', 'opt-1', { value: 'Vàng' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the option does not exist', async () => {
      repository.findOptionById.mockResolvedValue(null);
      await expect(
        service.addValue('prod-1', 'missing', { value: 'Vàng' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('trims and normalizes the value before creating it', async () => {
      repository.findOptionById.mockResolvedValue(buildOption());
      repository.addValue.mockImplementation((data) =>
        Promise.resolve({ id: 'val-new', ...data } as ProductOptionValueEntity),
      );

      const result = await service.addValue('prod-1', 'opt-1', {
        value: '  Vàng  ',
      });

      expect(result.value).toBe('Vàng');
      expect(repository.addValue).toHaveBeenCalledWith(
        expect.objectContaining({ normalizedValue: 'vàng' }),
      );
    });

    it('converts a duplicate-value database violation into 409 Conflict', async () => {
      repository.findOptionById.mockResolvedValue(buildOption());
      repository.addValue.mockRejectedValue(buildUniqueViolation());

      await expect(
        service.addValue('prod-1', 'opt-1', { value: 'Đỏ' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listOptions', () => {
    it('returns options sorted with their values, grouped correctly', async () => {
      const optionA = buildOption({ id: 'opt-a', displayOrder: 1 });
      const optionB = buildOption({ id: 'opt-b', displayOrder: 0 });
      repository.findByProductId.mockResolvedValue([optionA, optionB]);
      repository.findValuesByOptionIds.mockResolvedValue([
        {
          id: 'val-1',
          optionId: 'opt-a',
          value: 'X',
          displayOrder: 0,
        } as ProductOptionValueEntity,
        {
          id: 'val-2',
          optionId: 'opt-b',
          value: 'Y',
          displayOrder: 0,
        } as ProductOptionValueEntity,
      ]);

      const result = await service.listOptions('prod-1');

      expect(result).toHaveLength(2);
      expect(result.find((o) => o.id === 'opt-a')?.values).toEqual([
        { id: 'val-1', value: 'X', displayOrder: 0 },
      ]);
    });

    it('returns an empty array for a product with no options', async () => {
      repository.findByProductId.mockResolvedValue([]);
      const result = await service.listOptions('prod-1');
      expect(result).toEqual([]);
    });
  });
});
