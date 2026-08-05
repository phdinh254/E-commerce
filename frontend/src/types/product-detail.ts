// Real backend contract types for the product detail page (Chapter 14).
// Mirrors, field-for-field, the response DTOs actually returned by the
// backend — no invented fields (no "rating", "brand", "stockStatus", etc.,
// none of which exist on any backend entity). Sources:
//   - backend/src/modules/products/dto/product-response.dto.ts
//   - backend/src/modules/products/variants/dto/product-variant-response.dto.ts
//   - backend/src/modules/products/variants/dto/product-option-response.dto.ts
//   - backend/src/modules/products/images/dto/product-image-response.dto.ts
//   - backend/src/modules/products/attributes/dto/product-attribute-response.dto.ts
import type { CategoryRef } from "@/types/catalog";

/** GET /products/slug/:slug */
export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  thumbnailUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder: number;
  category: CategoryRef | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /products/:productId/options — value option belonging to a ProductOption */
export interface ProductOptionValue {
  id: string;
  value: string;
  displayOrder: number;
}

export interface ProductOption {
  id: string;
  name: string;
  displayOrder: number;
  values: ProductOptionValue[];
}

/** GET /products/:productId/variants */
export interface ProductVariantOptionValueRef {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  optionValues: ProductVariantOptionValueRef[];
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /products/:productId/images — `url` is a freshly-signed URL that
 * expires in `urlExpiresInSeconds`; never persist or cache it beyond the
 * lifetime of the query that fetched it.
 */
export interface ProductImage {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  urlExpiresInSeconds: number;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /products/:productId/attributes — server already filters to isVisible=true (listPublic). */
export interface ProductAttribute {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}
