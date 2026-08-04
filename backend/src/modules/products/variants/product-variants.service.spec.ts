import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariantsRepository } from './product-variants.repository';
import { ProductOptionsRepository } from './product-options.repository';
import { ProductsService } from '../products.service';
import { ProductEntity } from '../entities/product.entity';
import { ProductOptionEntity } from './entities/product-option.entity';
import { ProductOptionValueEntity } from './entities/product-option-value.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { VariantChangeType } from './enums/variant-change-type.enum';

function buildProduct(overrides: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id: 'prod-1',
    sku: 'PARENT-SKU',
    price: 100000,
    ...overrides,
  } as ProductEntity;
}

function buildOption(id: string, displayOrder = 0): ProductOptionEntity {
  return {
    id,
    productId: 'prod-1',
    name: `Option ${id}`,
    displayOrder,
  } as ProductOptionEntity;
}

function buildValue(
  id: string,
  optionId: string,
  value = 'V',
): ProductOptionValueEntity {
  return { id, optionId, value } as ProductOptionValueEntity;
}

function buildVariant(
  overrides: Partial<ProductVariantEntity> = {},
): ProductVariantEntity {
  return {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'VAR-SKU',
    combinationKey: 'key',
    price: 100000,
    stock: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductVariantEntity;
}

function buildUniqueViolation(constraint?: string): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { code: string }).code = '23505';
  if (constraint) {
    (error as unknown as { constraint: string }).constraint = constraint;
  }
  return error;
}

describe('ProductVariantsService', () => {
  let variantsRepository: jest.Mocked<
    Pick<
      ProductVariantsRepository,
      | 'findById'
      | 'createWithOptionValues'
      | 'findManyWithOptionValues'
      | 'updatePriceAndStock'
      | 'findAuditLogs'
    >
  >;
  let optionsRepository: jest.Mocked<
    Pick<ProductOptionsRepository, 'findByProductId' | 'findValuesByIds'>
  >;
  let productsService: jest.Mocked<
    Pick<ProductsService, 'getManageableOrThrow' | 'getPublicOrThrow'>
  >;
  let service: ProductVariantsService;

  const optionA = buildOption('opt-a', 0);
  const optionB = buildOption('opt-b', 1);
  const valueA1 = buildValue('val-a1', 'opt-a', 'Đỏ');
  const valueB1 = buildValue('val-b1', 'opt-b', 'M');

  beforeEach(() => {
    variantsRepository = {
      findById: jest.fn(),
      createWithOptionValues: jest.fn(),
      findManyWithOptionValues: jest.fn(),
      updatePriceAndStock: jest.fn(),
      findAuditLogs: jest.fn(),
    };
    optionsRepository = {
      findByProductId: jest.fn().mockResolvedValue([optionA, optionB]),
      findValuesByIds: jest.fn(),
    };
    productsService = {
      getManageableOrThrow: jest.fn().mockResolvedValue(buildProduct()),
      getPublicOrThrow: jest.fn().mockResolvedValue(buildProduct()),
    };
    service = new ProductVariantsService(
      variantsRepository as unknown as ProductVariantsRepository,
      optionsRepository as unknown as ProductOptionsRepository,
      productsService as unknown as ProductsService,
    );
  });

  describe('createVariant', () => {
    it('rejects a variant SKU equal to the parent product SKU (400)', async () => {
      await expect(
        service.createVariant('prod-1', {
          sku: 'PARENT-SKU',
          optionValueIds: ['val-a1', 'val-b1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the product has no options (400)', async () => {
      optionsRepository.findByProductId.mockResolvedValue([]);
      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when an optionValueId does not exist (400)', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1]);
      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1', 'missing-id'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a value belongs to an option outside this product (400)', async () => {
      const foreignValue = buildValue('val-x', 'opt-foreign');
      optionsRepository.findValuesByIds.mockResolvedValue([
        valueA1,
        foreignValue,
      ]);
      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1', 'val-x'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects two values of the same option (400)', async () => {
      const valueA2 = buildValue('val-a2', 'opt-a', 'Xanh');
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1, valueA2]);
      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1', 'val-a2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing option (400)', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1]);
      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to the parent Product.price when price is omitted', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1, valueB1]);
      variantsRepository.createWithOptionValues.mockImplementation((data) =>
        Promise.resolve(buildVariant({ price: data.price, sku: data.sku })),
      );

      const result = await service.createVariant('prod-1', {
        sku: 'V1',
        optionValueIds: ['val-a1', 'val-b1'],
      });

      expect(result.price).toBe(100000);
    });

    it('uses the explicit price when provided instead of the product price', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1, valueB1]);
      variantsRepository.createWithOptionValues.mockImplementation((data) =>
        Promise.resolve(buildVariant({ price: data.price, sku: data.sku })),
      );

      const result = await service.createVariant('prod-1', {
        sku: 'V1',
        price: 250000,
        optionValueIds: ['val-a1', 'val-b1'],
      });

      expect(result.price).toBe(250000);
    });

    it('maps a SKU unique-constraint violation to a distinct 409 code', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1, valueB1]);
      variantsRepository.createWithOptionValues.mockRejectedValue(
        buildUniqueViolation('UQ_product_variants_sku_upper'),
      );

      await expect(
        service.createVariant('prod-1', {
          sku: 'DUP',
          optionValueIds: ['val-a1', 'val-b1'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('maps a combination unique-constraint violation to a distinct 409 code', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueA1, valueB1]);
      variantsRepository.createWithOptionValues.mockRejectedValue(
        buildUniqueViolation('UQ_product_variants_product_id_combination_key'),
      );

      await expect(
        service.createVariant('prod-1', {
          sku: 'V1',
          optionValueIds: ['val-a1', 'val-b1'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns option values sorted by option displayOrder', async () => {
      optionsRepository.findValuesByIds.mockResolvedValue([valueB1, valueA1]);
      variantsRepository.createWithOptionValues.mockImplementation((data) =>
        Promise.resolve(buildVariant({ price: data.price })),
      );

      const result = await service.createVariant('prod-1', {
        sku: 'V1',
        optionValueIds: ['val-b1', 'val-a1'],
      });

      expect(result.optionValues.map((ov) => ov.optionId)).toEqual([
        'opt-a',
        'opt-b',
      ]);
    });
  });

  describe('updateVariant', () => {
    it('rejects an empty payload (400)', async () => {
      await expect(
        service.updateVariant('prod-1', 'var-1', { reason: 'x' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(variantsRepository.updatePriceAndStock).not.toHaveBeenCalled();
    });

    it('throws 404 when the variant does not exist or belongs to another product', async () => {
      variantsRepository.updatePriceAndStock.mockResolvedValue({
        kind: 'not_found',
      });

      await expect(
        service.updateVariant(
          'prod-1',
          'var-1',
          { price: 1000, reason: 'x' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes the actor and reason through to the repository', async () => {
      variantsRepository.updatePriceAndStock.mockResolvedValue({
        kind: 'ok',
        variant: buildVariant({ price: 5000 }),
        changed: true,
      });
      variantsRepository.findManyWithOptionValues.mockResolvedValue([]);

      await service.updateVariant(
        'prod-1',
        'var-1',
        { price: 5000, reason: 'Điều chỉnh giá' },
        'user-42',
      );

      expect(variantsRepository.updatePriceAndStock).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          variantId: 'var-1',
          price: 5000,
          reason: 'Điều chỉnh giá',
          actorUserId: 'user-42',
        }),
      );
    });
  });

  describe('getAuditLogs', () => {
    it('throws 404 when the variant does not belong to this product', async () => {
      variantsRepository.findById.mockResolvedValue(
        buildVariant({ productId: 'other-product' }),
      );
      await expect(
        service.getAuditLogs('prod-1', 'var-1', {
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns paginated audit entries', async () => {
      variantsRepository.findById.mockResolvedValue(buildVariant());
      variantsRepository.findAuditLogs.mockResolvedValue([
        [
          {
            id: 'log-1',
            changeType: VariantChangeType.PRICE,
            oldValue: 1000,
            newValue: 2000,
            delta: 1000,
            reason: 'x',
            actorUserId: 'user-1',
            mutationId: 'mut-1',
            createdAt: new Date(),
          } as never,
        ],
        1,
      ]);

      const result = await service.getAuditLogs('prod-1', 'var-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });
});
