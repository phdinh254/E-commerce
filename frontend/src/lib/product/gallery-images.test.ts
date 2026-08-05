import { describe, it, expect } from "vitest";
import { selectGalleryImages } from "./gallery-images";
import type { ProductImage } from "@/types/product-detail";

function image(id: string, overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id,
    productId: "p1",
    variantId: null,
    url: `https://signed.example/${id}`,
    urlExpiresInSeconds: 3600,
    mimeType: "image/webp",
    sizeBytes: 1000,
    altText: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectGalleryImages", () => {
  it("returns product-level images sorted by displayOrder when no variant is selected", () => {
    const images = [image("a", { displayOrder: 2 }), image("b", { displayOrder: 1 })];
    expect(selectGalleryImages(images, undefined).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("prefers the selected variant's own images over product-level images", () => {
    const images = [
      image("product-1", { variantId: null, displayOrder: 0 }),
      image("variant-1", { variantId: "v1", displayOrder: 0 }),
    ];
    expect(selectGalleryImages(images, "v1").map((i) => i.id)).toEqual(["variant-1"]);
  });

  it("falls back to product-level images when the selected variant has none of its own", () => {
    const images = [image("product-1", { variantId: null }), image("other-variant", { variantId: "v2" })];
    expect(selectGalleryImages(images, "v1").map((i) => i.id)).toEqual(["product-1"]);
  });

  it("never mixes variant and product images once the variant has any of its own", () => {
    const images = [
      image("product-1", { variantId: null }),
      image("variant-1a", { variantId: "v1", displayOrder: 1 }),
      image("variant-1b", { variantId: "v1", displayOrder: 0 }),
    ];
    const result = selectGalleryImages(images, "v1");
    expect(result.map((i) => i.id)).toEqual(["variant-1b", "variant-1a"]);
  });

  it("returns an empty array when there are no images at all", () => {
    expect(selectGalleryImages([], undefined)).toEqual([]);
  });
});
