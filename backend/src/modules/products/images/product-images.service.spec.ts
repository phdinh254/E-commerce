import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageConflictError,
  StorageUnavailableError,
} from '../../../infrastructure/storage/storage.interface';
import type { StorageProvider } from '../../../infrastructure/storage/storage.interface';
import { ProductImagesService } from './product-images.service';
import { ProductImagesRepository } from './product-images.repository';
import { ProductVariantsRepository } from '../variants/product-variants.repository';
import { ProductsService } from '../products.service';
import { ProductImageEntity } from './entities/product-image.entity';
import { ProductEntity } from '../entities/product.entity';
import { ProductVariantEntity } from '../variants/entities/product-variant.entity';

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function buildProduct(overrides: Partial<ProductEntity> = {}): ProductEntity {
  return { id: 'prod-1', isActive: true, ...overrides } as ProductEntity;
}

function buildVariant(
  overrides: Partial<ProductVariantEntity> = {},
): ProductVariantEntity {
  return {
    id: 'var-1',
    productId: 'prod-1',
    isActive: true,
    ...overrides,
  } as ProductVariantEntity;
}

function buildImage(
  overrides: Partial<ProductImageEntity> = {},
): ProductImageEntity {
  return {
    id: 'img-1',
    productId: 'prod-1',
    variantId: null,
    storageBucket: 'product-images',
    objectPath: 'products/prod-1/uuid.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: JPEG_BYTES.length,
    altText: null,
    displayOrder: 0,
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductImageEntity;
}

function buildFile(
  buffer: Buffer,
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer,
    size: buffer.length,
    ...overrides,
  } as Express.Multer.File;
}

describe('ProductImagesService', () => {
  let imagesRepository: jest.Mocked<
    Pick<
      ProductImagesRepository,
      | 'create'
      | 'save'
      | 'saveMany'
      | 'findById'
      | 'findManyByProductId'
      | 'softDelete'
      | 'maxDisplayOrder'
    >
  >;
  let variantsRepository: jest.Mocked<
    Pick<ProductVariantsRepository, 'findById'>
  >;
  let productsService: jest.Mocked<
    Pick<ProductsService, 'getManageableOrThrow' | 'getPublicOrThrow'>
  >;
  let storageProvider: jest.Mocked<
    Pick<
      StorageProvider,
      'upload' | 'remove' | 'getSignedUrl' | 'getBucketName'
    >
  >;
  let configService: Pick<ConfigService, 'get'>;
  let service: ProductImagesService;

  beforeEach(() => {
    imagesRepository = {
      create: jest.fn((data) => data as ProductImageEntity),
      save: jest.fn((entity) => Promise.resolve(entity)),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findManyByProductId: jest.fn().mockResolvedValue([]),
      softDelete: jest.fn().mockResolvedValue(undefined),
      maxDisplayOrder: jest.fn().mockResolvedValue(-1),
    };
    variantsRepository = { findById: jest.fn() };
    productsService = {
      getManageableOrThrow: jest.fn().mockResolvedValue(buildProduct()),
      getPublicOrThrow: jest.fn().mockResolvedValue(buildProduct()),
    };
    storageProvider = {
      upload: jest
        .fn()
        .mockResolvedValue({ path: 'x', bucket: 'product-images' }),
      remove: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
      getBucketName: jest.fn().mockReturnValue('product-images'),
    };
    configService = {
      get: jest.fn().mockReturnValue({ signedUrlTtlSeconds: 3600 }),
    };

    service = new ProductImagesService(
      imagesRepository as unknown as ProductImagesRepository,
      variantsRepository as unknown as ProductVariantsRepository,
      productsService as unknown as ProductsService,
      configService as ConfigService,
      storageProvider,
    );
  });

  describe('uploadSingle', () => {
    it('uploads and creates a DB record, returning a signed URL', async () => {
      const result = await service.uploadSingle(
        'prod-1',
        'admin-1',
        buildFile(JPEG_BYTES),
        {},
      );
      expect(storageProvider.upload).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/jpeg' }),
      );
      expect(result.url).toBe('https://signed.example/x');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('rejects a missing file (400)', async () => {
      await expect(
        service.uploadSingle('prod-1', 'admin-1', undefined, {}),
      ).rejects.toThrow(BadRequestException);
      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('rejects an empty file buffer (400)', async () => {
      await expect(
        service.uploadSingle(
          'prod-1',
          'admin-1',
          buildFile(Buffer.alloc(0)),
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an HTML file renamed to .jpg — magic bytes do not match any allowed type (400)', async () => {
      const html = buildFile(Buffer.from('<html>evil</html>', 'utf-8'));
      await expect(
        service.uploadSingle('prod-1', 'admin-1', html, {}),
      ).rejects.toThrow(BadRequestException);
      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('ignores the client-declared mimetype entirely — detection is by content only', async () => {
      // file.mimetype claims image/jpeg, but the actual bytes are PNG — the
      // stored mimeType must reflect the DETECTED type, not the client's.
      const spoofed = buildFile(PNG_BYTES, { mimetype: 'image/jpeg' });
      const result = await service.uploadSingle(
        'prod-1',
        'admin-1',
        spoofed,
        {},
      );
      expect(result.mimeType).toBe('image/png');
    });

    it('rejects a Product that is soft-deleted (propagates NotFoundException from ProductsService)', async () => {
      productsService.getManageableOrThrow.mockRejectedValue(
        new NotFoundException({ code: 'PRODUCT_NOT_FOUND' }),
      );
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {}),
      ).rejects.toThrow(NotFoundException);
      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('rejects a variantId belonging to a different product (404)', async () => {
      variantsRepository.findById.mockResolvedValue(
        buildVariant({ productId: 'prod-OTHER' }),
      );
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {
          variantId: 'var-1',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('links to the variant when it belongs to the same product', async () => {
      variantsRepository.findById.mockResolvedValue(buildVariant());
      const result = await service.uploadSingle(
        'prod-1',
        'admin-1',
        buildFile(JPEG_BYTES),
        { variantId: 'var-1' },
      );
      expect(result.variantId).toBe('var-1');
    });

    it('maps Supabase upload failure to 503 and never inserts a DB row', async () => {
      storageProvider.upload.mockRejectedValue(
        new StorageUnavailableError('down'),
      );
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {}),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(imagesRepository.save).not.toHaveBeenCalled();
      expect(storageProvider.remove).not.toHaveBeenCalled(); // nothing to compensate — upload itself failed
    });

    it('maps a duplicate object path to 409', async () => {
      storageProvider.upload.mockRejectedValue(
        new StorageConflictError('exists'),
      );
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {}),
      ).rejects.toThrow(ConflictException);
    });

    it('compensates (deletes the uploaded object) when the DB insert fails after a successful upload', async () => {
      imagesRepository.save.mockRejectedValue(new Error('db down'));
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {}),
      ).rejects.toThrow('db down');
      expect(storageProvider.remove).toHaveBeenCalledTimes(1);
    });

    it('does not mask the original DB error even if compensation delete itself fails', async () => {
      imagesRepository.save.mockRejectedValue(new Error('db down'));
      storageProvider.remove.mockRejectedValue(
        new Error('cleanup also failed'),
      );
      await expect(
        service.uploadSingle('prod-1', 'admin-1', buildFile(JPEG_BYTES), {}),
      ).rejects.toThrow('db down');
    });
  });

  describe('uploadBulk', () => {
    it('uploads multiple files and inserts all rows in order', async () => {
      imagesRepository.saveMany.mockImplementation((rows) =>
        Promise.resolve(
          rows.map((r, i) => buildImage({ ...r, id: `img-${i}` })),
        ),
      );
      const result = await service.uploadBulk(
        'prod-1',
        'admin-1',
        [
          buildFile(JPEG_BYTES),
          buildFile(PNG_BYTES, { originalname: 'b.png' }),
        ],
        {},
      );
      expect(result).toHaveLength(2);
      expect(storageProvider.upload).toHaveBeenCalledTimes(2);
    });

    it('rejects an empty files array (400)', async () => {
      await expect(
        service.uploadBulk('prod-1', 'admin-1', [], {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects the entire request when one file is invalid, before uploading anything', async () => {
      const files = [
        buildFile(JPEG_BYTES),
        buildFile(Buffer.from('<html>evil</html>'), {
          originalname: 'evil.jpg',
        }),
      ];
      await expect(
        service.uploadBulk('prod-1', 'admin-1', files, {}),
      ).rejects.toThrow(BadRequestException);
      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('cleans up already-uploaded objects when one upload fails mid-batch', async () => {
      storageProvider.upload
        .mockResolvedValueOnce({ path: 'p1', bucket: 'b' })
        .mockRejectedValueOnce(new StorageUnavailableError('flaky'));

      await expect(
        service.uploadBulk(
          'prod-1',
          'admin-1',
          [
            buildFile(JPEG_BYTES),
            buildFile(PNG_BYTES, { originalname: 'b.png' }),
          ],
          {},
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(storageProvider.remove).toHaveBeenCalledTimes(1);
      expect(imagesRepository.saveMany).not.toHaveBeenCalled();
    });

    it('cleans up all uploaded objects when the DB transaction fails', async () => {
      imagesRepository.saveMany.mockRejectedValue(new Error('tx rollback'));
      await expect(
        service.uploadBulk(
          'prod-1',
          'admin-1',
          [
            buildFile(JPEG_BYTES),
            buildFile(PNG_BYTES, { originalname: 'b.png' }),
          ],
          {},
        ),
      ).rejects.toThrow('tx rollback');
      expect(storageProvider.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe('listPublic', () => {
    it('returns only Product-level images when no variantId is given', async () => {
      imagesRepository.findManyByProductId.mockResolvedValue([buildImage()]);
      const result = await service.listPublic('prod-1');
      expect(imagesRepository.findManyByProductId).toHaveBeenCalledWith(
        'prod-1',
        {
          variantId: null,
        },
      );
      expect(result).toHaveLength(1);
    });

    it('rejects an inactive Product (404, via ProductsService.getPublicOrThrow)', async () => {
      productsService.getPublicOrThrow.mockRejectedValue(
        new NotFoundException({ code: 'PRODUCT_NOT_FOUND' }),
      );
      await expect(service.listPublic('prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a variantId for an inactive Variant (404 — never shown publicly)', async () => {
      variantsRepository.findById.mockResolvedValue(
        buildVariant({ isActive: false }),
      );
      await expect(service.listPublic('prod-1', 'var-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a variantId belonging to a different product (404)', async () => {
      variantsRepository.findById.mockResolvedValue(
        buildVariant({ productId: 'prod-OTHER' }),
      );
      await expect(service.listPublic('prod-1', 'var-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('merges Product-level + Variant images when variantId is active and owned', async () => {
      variantsRepository.findById.mockResolvedValue(buildVariant());
      imagesRepository.findManyByProductId
        .mockResolvedValueOnce([buildImage({ id: 'p1' })])
        .mockResolvedValueOnce([buildImage({ id: 'v1', variantId: 'var-1' })]);
      const result = await service.listPublic('prod-1', 'var-1');
      expect(result.map((r) => r.id).sort()).toEqual(['p1', 'v1']);
    });
  });

  describe('updateMetadata', () => {
    it('rejects an empty payload (400)', async () => {
      await expect(
        service.updateMetadata('prod-1', 'img-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an image that does not belong to the product in the URL (404)', async () => {
      imagesRepository.findById.mockResolvedValue(
        buildImage({ productId: 'prod-OTHER' }),
      );
      await expect(
        service.updateMetadata('prod-1', 'img-1', { altText: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates altText', async () => {
      imagesRepository.findById.mockResolvedValue(buildImage());
      const result = await service.updateMetadata('prod-1', 'img-1', {
        altText: 'Mặt trước',
      });
      expect(result.altText).toBe('Mặt trước');
    });
  });

  describe('remove', () => {
    it('soft-deletes the DB row and requests storage removal using the DB-stored path', async () => {
      const image = buildImage({ objectPath: 'products/prod-1/real-path.jpg' });
      imagesRepository.findById.mockResolvedValue(image);
      await service.remove('prod-1', 'img-1');
      expect(imagesRepository.softDelete).toHaveBeenCalledWith('img-1');
      expect(storageProvider.remove).toHaveBeenCalledWith(
        'products/prod-1/real-path.jpg',
      );
    });

    it('still soft-deletes even if the storage removal fails (residual risk, not a false success)', async () => {
      imagesRepository.findById.mockResolvedValue(buildImage());
      storageProvider.remove.mockRejectedValue(new Error('storage down'));
      await expect(service.remove('prod-1', 'img-1')).resolves.toBeUndefined();
      expect(imagesRepository.softDelete).toHaveBeenCalled();
    });

    it('rejects an image belonging to a different product (404)', async () => {
      imagesRepository.findById.mockResolvedValue(
        buildImage({ productId: 'prod-OTHER' }),
      );
      await expect(service.remove('prod-1', 'img-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(imagesRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('linkVariant', () => {
    it('links an image to a variant of the same product', async () => {
      imagesRepository.findById.mockResolvedValue(buildImage());
      variantsRepository.findById.mockResolvedValue(buildVariant());
      const result = await service.linkVariant('prod-1', 'img-1', {
        variantId: 'var-1',
      });
      expect(result.variantId).toBe('var-1');
    });

    it('rejects linking to a variant of a different product (404 — prevents IDOR)', async () => {
      imagesRepository.findById.mockResolvedValue(buildImage());
      variantsRepository.findById.mockResolvedValue(
        buildVariant({ productId: 'prod-OTHER' }),
      );
      await expect(
        service.linkVariant('prod-1', 'img-1', { variantId: 'var-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('unlinks back to Product-level when variantId is null', async () => {
      imagesRepository.findById.mockResolvedValue(
        buildImage({ variantId: 'var-1' }),
      );
      const result = await service.linkVariant('prod-1', 'img-1', {
        variantId: null,
      });
      expect(result.variantId).toBeNull();
    });
  });

  describe('listForAdmin', () => {
    it('requires the manageable (not-soft-deleted) product, may include inactive-variant images', async () => {
      imagesRepository.findManyByProductId.mockResolvedValue([
        buildImage({ variantId: 'var-inactive' }),
      ]);
      const result = await service.listForAdmin('prod-1');
      expect(productsService.getManageableOrThrow).toHaveBeenCalledWith(
        'prod-1',
      );
      expect(result).toHaveLength(1);
    });
  });
});
