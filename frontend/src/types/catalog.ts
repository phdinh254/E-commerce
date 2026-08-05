// Real backend contract types — mirrors ProductResponseDto / CategoryResponseDto
// / PaginationMetaDto (backend/src/modules/products/dto/product-response.dto.ts,
// backend/src/modules/categories/dto/category-response.dto.ts). Deliberately NOT
// the same shape as `@/types/commerce`'s `Product`/`Category` — those describe
// the still-mock cart/checkout/admin domains (brand, rating, stock, variants —
// none of which exist on the real Product entity) and must not be conflated
// with what the catalog API actually returns.

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogProduct {
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
  category: CategoryRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedProducts {
  items: CatalogProduct[];
  meta: PaginationMeta;
}

/** Matches backend PRODUCT_SORT_FIELDS — see query-product.dto.ts. */
export type ProductApiSortField = 'relevance' | 'name' | 'price' | 'createdAt';
export type ProductApiSortOrder = 'ASC' | 'DESC';

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  sortBy?: ProductApiSortField;
  sortOrder?: ProductApiSortOrder;
  minPrice?: number;
  maxPrice?: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCategories {
  items: Category[];
  meta: PaginationMeta;
}
