import { apiClient } from "@/lib/api/client";
import type { PaginatedProducts, ProductListQuery } from "@/types/catalog";

/**
 * Whitelists and normalizes the query before it ever reaches axios —
 * never forwards `undefined`, `NaN`, or an empty string, and never lets a
 * caller send an arbitrary field the backend doesn't define
 * (QueryProductDto only accepts page/limit/search/categoryId/sortBy/
 * sortOrder/minPrice/maxPrice).
 */
export function buildProductListParams(
  query: ProductListQuery,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (typeof query.page === "number" && Number.isFinite(query.page)) {
    params.page = query.page;
  }
  if (typeof query.limit === "number" && Number.isFinite(query.limit)) {
    params.limit = query.limit;
  }
  if (typeof query.search === "string" && query.search.trim() !== "") {
    params.search = query.search.trim();
  }
  if (query.categoryId) {
    params.categoryId = query.categoryId;
  }
  if (query.sortBy) {
    params.sortBy = query.sortBy;
  }
  if (query.sortOrder) {
    params.sortOrder = query.sortOrder;
  }
  if (typeof query.minPrice === "number" && Number.isFinite(query.minPrice)) {
    params.minPrice = query.minPrice;
  }
  if (typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice)) {
    params.maxPrice = query.maxPrice;
  }

  return params;
}

export const productsApi = {
  async list(
    query: ProductListQuery,
    signal?: AbortSignal,
  ): Promise<PaginatedProducts> {
    const response = await apiClient.get<PaginatedProducts>("/products", {
      params: buildProductListParams(query),
      signal,
    });
    return response.data;
  },
};
