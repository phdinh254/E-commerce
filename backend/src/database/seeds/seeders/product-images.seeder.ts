import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { EntityManager } from 'typeorm';
import { ProductImageEntity } from '../../../modules/products/images/entities/product-image.entity';
import type { StorageProvider } from '../../../infrastructure/storage/storage.interface';
import {
  detectImageMimeType,
  extensionForImageMimeType,
} from '../../../common/utils/image-signature.util';
import { resolveWithinRoot } from '../helpers/resolve-within-root';
import { ProductImageSeedRecordDto } from '../dto/product-image-seed-record.dto';

export const SEED_ASSETS_ROOT = resolve(__dirname, '..', 'assets');

export interface ProductImagesSeedResult {
  created: number;
  alreadyExisted: number;
  /** true when Supabase Storage is not configured — the step is skipped, not faked. */
  storageSkipped: boolean;
}

/**
 * Object path is deterministic (`seed/products/{productSlug}/{scope}-{n}.
 * {ext}`), NOT a random UUID like the Ch11 runtime upload endpoint uses —
 * this is what makes the seed idempotent for images: re-running seed.ts
 * finds the same (bucket, objectPath) already in `product_images` and
 * skips re-uploading, rather than accumulating a new object every run.
 * The `seed/` prefix namespaces every object this seeder ever creates, so
 * reset.ts's storage cleanup step can enumerate exactly (and only) what it
 * owns — see reset.ts and docs/seed-strategy.md.
 */
function buildSeedObjectPath(
  productSlug: string,
  variantSku: string | undefined,
  indexInGroup: number,
  extension: string,
): string {
  const scope = variantSku ? `variant-${variantSku.toLowerCase()}` : 'product';
  return `seed/products/${productSlug}/${scope}-${indexInGroup}.${extension}`;
}

/**
 * `storageProvider === null` means Supabase Storage is not configured in
 * this environment — the step is skipped cleanly (logged, reflected in
 * the summary as `storageSkipped: true`), never faked. See
 * docs/seed-strategy.md policy A/D discussion.
 */
export async function seedProductImages(
  manager: EntityManager,
  records: ProductImageSeedRecordDto[],
  productSlugToId: Map<string, string>,
  variantSkuToId: Map<string, string>,
  variantSkuToProductSlug: Map<string, string>,
  storageProvider: StorageProvider | null,
  createdByUserId: string,
): Promise<ProductImagesSeedResult> {
  if (!storageProvider) {
    return { created: 0, alreadyExisted: 0, storageSkipped: true };
  }

  const repository = manager.getRepository(ProductImageEntity);
  const bucket = storageProvider.getBucketName();

  // Index each image within its (productSlug, variantSku) group so that
  // multiple images sharing the same product/variant still get distinct,
  // stable object paths across runs.
  const groupCounters = new Map<string, number>();

  let created = 0;
  let alreadyExisted = 0;

  for (const record of records) {
    const productId = productSlugToId.get(record.productSlug);
    if (!productId) {
      throw new Error(
        `seedProductImages: product "${record.productSlug}" was not resolved`,
      );
    }
    let variantId: string | null = null;
    if (record.variantSku) {
      const resolvedVariantId = variantSkuToId.get(record.variantSku);
      const owningProductSlug = variantSkuToProductSlug.get(record.variantSku);
      if (!resolvedVariantId || owningProductSlug !== record.productSlug) {
        throw new Error(
          `seedProductImages: variantSku "${record.variantSku}" was not resolved for product "${record.productSlug}"`,
        );
      }
      variantId = resolvedVariantId;
    }

    const groupKey = `${record.productSlug}::${record.variantSku ?? ''}`;
    const indexInGroup = groupCounters.get(groupKey) ?? 0;
    groupCounters.set(groupKey, indexInGroup + 1);

    const assetPath = resolveWithinRoot(SEED_ASSETS_ROOT, record.assetFile);
    const buffer = await readFile(assetPath);
    const detected = detectImageMimeType(buffer);
    if (!detected) {
      throw new Error(
        `seedProductImages: asset "${record.assetFile}" is not a valid JPEG/PNG/WebP (magic bytes did not match)`,
      );
    }
    const extension = extensionForImageMimeType(detected);
    const objectPath = buildSeedObjectPath(
      record.productSlug,
      record.variantSku,
      indexInGroup,
      extension,
    );

    const existing = await repository.findOne({
      where: { storageBucket: bucket, objectPath },
    });
    if (existing) {
      alreadyExisted += 1;
      continue;
    }

    await storageProvider.upload({
      path: objectPath,
      buffer,
      contentType: detected,
    });

    try {
      const entity = repository.create({
        productId,
        variantId,
        storageBucket: bucket,
        objectPath,
        mimeType: detected,
        sizeBytes: buffer.length,
        altText: record.altText ?? null,
        displayOrder: record.displayOrder ?? 0,
        createdBy: createdByUserId,
      });
      await repository.save(entity);
      created += 1;
    } catch (error) {
      // Compensation: DB insert failed right after a successful upload —
      // Storage and PostgreSQL are not one transaction (see Ch11 report /
      // docs/seed-strategy.md), so the just-uploaded object must not be
      // left dangling with no DB row pointing at it.
      try {
        await storageProvider.remove(objectPath);
      } catch {
        // Sanitized, no secret — logged so a human can clean up the orphan.

        console.error(
          `seedProductImages: compensation cleanup failed for orphaned object path=${objectPath}`,
        );
      }
      throw error;
    }
  }

  return { created, alreadyExisted, storageSkipped: false };
}
