import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORAGE_PROVIDER,
  StorageConflictError,
  StorageUnavailableError,
} from '../../../infrastructure/storage/storage.interface';
import type { StorageProvider } from '../../../infrastructure/storage/storage.interface';
import { SupabaseConfig } from '../../../config/configuration';
import {
  detectImageMimeType,
  extensionForImageMimeType,
} from '../../../common/utils/image-signature.util';
import { ProductsService } from '../products.service';
import { ProductVariantsRepository } from '../variants/product-variants.repository';
import { ProductVariantEntity } from '../variants/entities/product-variant.entity';
import { ProductImagesRepository } from './product-images.repository';
import { ProductImageEntity } from './entities/product-image.entity';
import { buildProductImageObjectPath } from './object-path.util';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { BulkCreateProductImageDto } from './dto/bulk-create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { LinkVariantDto } from './dto/link-variant.dto';
import { ProductImageResponseDto } from './dto/product-image-response.dto';

/** Uploads/removals run in bounded batches — never unlimited `Promise.all`. */
const STORAGE_CONCURRENCY = 3;

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly imagesRepository: ProductImagesRepository,
    private readonly variantsRepository: ProductVariantsRepository,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  // -------------------------------------------------------------------
  // Upload (Ch11-B101 / Ch11-B102 / Ch11-B103)
  // -------------------------------------------------------------------

  async uploadSingle(
    productId: string,
    actorUserId: string,
    file: Express.Multer.File | undefined,
    dto: CreateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    this.assertFilePresent(file);

    const variant = dto.variantId
      ? await this.assertVariantOwnership(productId, dto.variantId)
      : null;

    const detected = detectImageMimeType(file.buffer);
    if (!detected) {
      throw this.unsupportedContentError();
    }

    const bucket = this.storageProvider.getBucketName();
    const objectPath = buildProductImageObjectPath(
      productId,
      extensionForImageMimeType(detected),
    );

    let uploaded = false;
    try {
      await this.storageProvider.upload({
        path: objectPath,
        buffer: file.buffer,
        contentType: detected,
      });
      uploaded = true;

      const displayOrder =
        dto.displayOrder ??
        (await this.imagesRepository.maxDisplayOrder(productId)) + 1;

      const entity = this.imagesRepository.create({
        productId,
        variantId: variant?.id ?? null,
        storageBucket: bucket,
        objectPath,
        mimeType: detected,
        sizeBytes: file.buffer.length,
        altText: dto.altText ?? null,
        displayOrder,
        createdBy: actorUserId,
      });
      const saved = await this.imagesRepository.save(entity);
      return await this.toResponse(saved);
    } catch (error) {
      if (uploaded) {
        await this.compensateRemove([objectPath]);
      }
      throw this.mapUploadError(error);
    }
  }

  async uploadBulk(
    productId: string,
    actorUserId: string,
    files: Express.Multer.File[] | undefined,
    dto: BulkCreateProductImageDto,
  ): Promise<ProductImageResponseDto[]> {
    await this.productsService.getManageableOrThrow(productId);
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'FILES_REQUIRED',
        message: 'Phải cung cấp ít nhất một file ảnh',
      });
    }

    const variant = dto.variantId
      ? await this.assertVariantOwnership(productId, dto.variantId)
      : null;

    // Validate every file BEFORE uploading any of them — one invalid file
    // fails the whole request (Ch11-B102's all-or-nothing policy).
    const detectedTypes = files.map((file) => {
      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException({
          code: 'EMPTY_FILE',
          message: `File "${file.originalname}" rỗng`,
        });
      }
      const detected = detectImageMimeType(file.buffer);
      if (!detected) {
        throw this.unsupportedContentError(file.originalname);
      }
      return detected;
    });

    const bucket = this.storageProvider.getBucketName();
    const baseDisplayOrder =
      (await this.imagesRepository.maxDisplayOrder(productId)) + 1;

    const uploadedPaths: string[] = [];
    const uploadedMeta: { path: string; mimeType: string; size: number }[] = [];
    let firstError: unknown = null;

    for (let start = 0; start < files.length; start += STORAGE_CONCURRENCY) {
      const batchFiles = files.slice(start, start + STORAGE_CONCURRENCY);
      const batchTypes = detectedTypes.slice(
        start,
        start + STORAGE_CONCURRENCY,
      );

      const settled = await Promise.allSettled(
        batchFiles.map(async (file, idx) => {
          const detected = batchTypes[idx];
          const objectPath = buildProductImageObjectPath(
            productId,
            extensionForImageMimeType(detected),
          );
          await this.storageProvider.upload({
            path: objectPath,
            buffer: file.buffer,
            contentType: detected,
          });
          return {
            path: objectPath,
            mimeType: detected,
            size: file.buffer.length,
          };
        }),
      );

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          uploadedPaths.push(outcome.value.path);
          uploadedMeta.push(outcome.value);
        } else if (firstError === null) {
          firstError = outcome.reason;
        }
      }

      if (firstError !== null) break;
    }

    if (firstError !== null) {
      await this.compensateRemove(uploadedPaths);
      throw this.mapUploadError(firstError);
    }

    try {
      const rows: Partial<ProductImageEntity>[] = uploadedMeta.map(
        (meta, idx) => ({
          productId,
          variantId: variant?.id ?? null,
          storageBucket: bucket,
          objectPath: meta.path,
          mimeType: meta.mimeType,
          sizeBytes: meta.size,
          altText: null,
          displayOrder: baseDisplayOrder + idx,
          createdBy: actorUserId,
        }),
      );
      const saved = await this.imagesRepository.saveMany(rows);
      return await this.toResponseList(saved);
    } catch (error) {
      await this.compensateRemove(uploadedPaths);
      throw this.mapUploadError(error);
    }
  }

  // -------------------------------------------------------------------
  // Read (Ch11-B104)
  // -------------------------------------------------------------------

  async listPublic(
    productId: string,
    variantId?: string,
  ): Promise<ProductImageResponseDto[]> {
    await this.productsService.getPublicOrThrow(productId);

    if (variantId === undefined) {
      const rows = await this.imagesRepository.findManyByProductId(productId, {
        variantId: null,
      });
      return this.toResponseList(rows);
    }

    const variant = await this.variantsRepository.findById(variantId);
    if (!variant || variant.productId !== productId || !variant.isActive) {
      throw this.variantNotFound();
    }

    const [productLevel, variantLevel] = await Promise.all([
      this.imagesRepository.findManyByProductId(productId, { variantId: null }),
      this.imagesRepository.findManyByProductId(productId, { variantId }),
    ]);

    const merged = [...productLevel, ...variantLevel].sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    return this.toResponseList(merged);
  }

  async listForAdmin(productId: string): Promise<ProductImageResponseDto[]> {
    await this.productsService.getManageableOrThrow(productId);
    const rows = await this.imagesRepository.findManyByProductId(productId);
    return this.toResponseList(rows);
  }

  // -------------------------------------------------------------------
  // Update / delete / variant linkage (Ch11-B104 / Ch11-B105)
  // -------------------------------------------------------------------

  async updateMetadata(
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    if (dto.altText === undefined && dto.displayOrder === undefined) {
      throw new BadRequestException({
        code: 'EMPTY_IMAGE_UPDATE',
        message: 'Phải cung cấp ít nhất một trong altText hoặc displayOrder',
      });
    }
    await this.productsService.getManageableOrThrow(productId);
    const image = await this.getOwnedImageOrThrow(productId, imageId);

    if (dto.altText !== undefined) {
      image.altText = dto.altText;
    }
    if (dto.displayOrder !== undefined) {
      image.displayOrder = dto.displayOrder;
    }

    const saved = await this.imagesRepository.save(image);
    return this.toResponse(saved);
  }

  async remove(productId: string, imageId: string): Promise<void> {
    await this.productsService.getManageableOrThrow(productId);
    const image = await this.getOwnedImageOrThrow(productId, imageId);

    // Soft-delete first: this alone guarantees the image is no longer
    // public/served, regardless of what happens to the Storage object next.
    await this.imagesRepository.softDelete(image.id);

    try {
      await this.storageProvider.remove(image.objectPath);
    } catch (error) {
      // Storage and PostgreSQL are not one atomic transaction (see
      // Ch11-B103/Ch11-B104 in the final report) — the DB row is already
      // gone from every public/admin query, but the physical object may
      // still exist. This is a residual-risk orphan, not a silent false
      // "deleted" claim: it is logged (sanitized — object path only, no
      // secret) for manual/backfill cleanup.
      this.logger.error(
        `Storage object removal failed after soft-delete for productImage=${image.id} path=${image.objectPath}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async linkVariant(
    productId: string,
    imageId: string,
    dto: LinkVariantDto,
  ): Promise<ProductImageResponseDto> {
    await this.productsService.getManageableOrThrow(productId);
    const image = await this.getOwnedImageOrThrow(productId, imageId);

    image.variantId =
      dto.variantId === null
        ? null
        : (await this.assertVariantOwnership(productId, dto.variantId)).id;

    const saved = await this.imagesRepository.save(image);
    return this.toResponse(saved);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private assertFilePresent(
    file?: Express.Multer.File,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Thiếu file ảnh',
      });
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'File ảnh rỗng',
      });
    }
  }

  private async assertVariantOwnership(
    productId: string,
    variantId: string,
  ): Promise<ProductVariantEntity> {
    const variant = await this.variantsRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw this.variantNotFound();
    }
    return variant;
  }

  private async getOwnedImageOrThrow(
    productId: string,
    imageId: string,
  ): Promise<ProductImageEntity> {
    const image = await this.imagesRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundException({
        code: 'PRODUCT_IMAGE_NOT_FOUND',
        message: 'Không tìm thấy ảnh của sản phẩm này',
      });
    }
    return image;
  }

  private variantNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_VARIANT_NOT_FOUND',
      message: 'Không tìm thấy biến thể của sản phẩm này',
    });
  }

  private unsupportedContentError(filename?: string): BadRequestException {
    return new BadRequestException({
      code: 'UNSUPPORTED_IMAGE_CONTENT',
      message: filename
        ? `File "${filename}" không phải ảnh JPEG/PNG/WebP hợp lệ`
        : 'Nội dung file không phải ảnh JPEG/PNG/WebP hợp lệ',
    });
  }

  /** Best-effort — logs sanitized path only, never throws (see `remove()`). */
  private async compensateRemove(paths: string[]): Promise<void> {
    for (let start = 0; start < paths.length; start += STORAGE_CONCURRENCY) {
      const batch = paths.slice(start, start + STORAGE_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((path) => this.storageProvider.remove(path)),
      );
      settled.forEach((outcome, idx) => {
        if (outcome.status === 'rejected') {
          this.logger.error(
            `Compensation cleanup failed for orphaned storage object at path=${batch[idx]} — manual removal required`,
          );
        }
      });
    }
  }

  private mapUploadError(error: unknown): Error {
    if (error instanceof StorageConflictError) {
      return new ConflictException({
        code: 'PRODUCT_IMAGE_OBJECT_PATH_CONFLICT',
        message: 'Đường dẫn lưu trữ đã tồn tại, vui lòng thử lại',
      });
    }
    if (error instanceof StorageUnavailableError) {
      return new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Không thể kết nối tới dịch vụ lưu trữ ảnh',
      });
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private signedUrlTtlSeconds(): number {
    return (
      this.configService.get<SupabaseConfig>('supabase')?.signedUrlTtlSeconds ??
      3600
    );
  }

  private async toResponse(
    image: ProductImageEntity,
  ): Promise<ProductImageResponseDto> {
    const ttl = this.signedUrlTtlSeconds();
    const url = await this.storageProvider.getSignedUrl(image.objectPath, ttl);
    return {
      id: image.id,
      productId: image.productId,
      variantId: image.variantId,
      url,
      urlExpiresInSeconds: ttl,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      altText: image.altText,
      displayOrder: image.displayOrder,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private toResponseList(
    images: ProductImageEntity[],
  ): Promise<ProductImageResponseDto[]> {
    return Promise.all(images.map((image) => this.toResponse(image)));
  }
}
