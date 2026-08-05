import type { ProductImage } from "@/types/product-detail";

/**
 * Chooses which images the gallery shows for the current variant:
 * variant-specific images take priority (sorted by displayOrder); if the
 * selected variant has none of its own, fall back to the product-level
 * images (variantId === null). Never mixes the two once the variant has any
 * images of its own — that would show garments/colors that don't apply.
 */
export function selectGalleryImages(
  images: ProductImage[],
  selectedVariantId: string | undefined,
): ProductImage[] {
  const byDisplayOrder = (a: ProductImage, b: ProductImage) => a.displayOrder - b.displayOrder;

  if (selectedVariantId) {
    const variantImages = images
      .filter((image) => image.variantId === selectedVariantId)
      .sort(byDisplayOrder);
    if (variantImages.length > 0) return variantImages;
  }

  return images.filter((image) => image.variantId === null).sort(byDisplayOrder);
}
