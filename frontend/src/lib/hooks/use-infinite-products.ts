"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { productsApi } from "@/lib/api/products";
import { queryKeys } from "@/lib/api/query-keys";
import type { CatalogFilters } from "@/lib/catalog/search-params";
import { catalogFiltersToApiQuery } from "@/lib/catalog/search-params";
import type { PaginatedProducts } from "@/types/catalog";

const PAGE_SIZE = 20;
const INITIAL_PAGE_PARAM = 1;

/** Never retries a 4xx (the request itself is wrong/won't change on retry) — only network errors and 5xx. */
function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true; // network error / no response at all
    return error.response.status >= 500;
  }
  return true;
}

export function useInfiniteProducts(
  filters: CatalogFilters,
  categorySlugToId: ReadonlyMap<string, string> | null,
): ReturnType<typeof useInfiniteQuery<PaginatedProducts, unknown, InfiniteData<PaginatedProducts>, ReturnType<typeof queryKeys.products.list>, number>> {
  const { query, categoryPending } = catalogFiltersToApiQuery(filters, categorySlugToId);
  const apiQuery = { ...query, limit: PAGE_SIZE };

  return useInfiniteQuery({
    // The query key is the exact, whitelisted API query (not the raw URL
    // filters) — it changes precisely when the resulting request would
    // change, and is stable (same shape every render) for equal input.
    queryKey: queryKeys.products.list(apiQuery),
    queryFn: ({ pageParam, signal }) => productsApi.list({ ...apiQuery, page: pageParam }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    // A category filter is present in the URL but not resolved to an ID
    // yet (categories still loading) — wait rather than firing an
    // unfiltered request for one render and then immediately refetching.
    enabled: !categoryPending,
    staleTime: 30_000,
    retry: (failureCount, error) => isRetryableError(error) && failureCount < 2,
  });
}
