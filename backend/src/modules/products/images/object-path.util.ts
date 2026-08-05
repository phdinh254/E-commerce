import { randomUUID } from 'crypto';

/**
 * Object path is always `products/{productId}/{uuid}.{ext}` — deliberately
 * NOT `products/{productId}/variants/{variantId}/...`, even for
 * variant-linked images. Variant linkage lives only in `product_images.
 * variant_id` (see ProductImageEntity), so re-linking an image to a
 * different variant (or unlinking it) is a pure database update — the
 * Supabase object never has to move. Encoding variantId in the path would
 * force a copy/re-upload on every re-link, which the business rules
 * explicitly want to avoid.
 *
 * The UUID (not the original filename or a timestamp) is what makes the
 * path collision-resistant and prevents path traversal — the client never
 * supplies any part of this path.
 */
export function buildProductImageObjectPath(
  productId: string,
  extension: string,
): string {
  return `products/${productId}/${randomUUID()}.${extension}`;
}
