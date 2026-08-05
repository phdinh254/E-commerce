"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { productsApi } from "@/lib/api/products";
import { queryKeys } from "@/lib/api/query-keys";

const RELATED_FETCH_LIMIT = 5; // one extra slot to cover excluding the current product below

function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  return true;
}

/**
 * Real, server-filtered "related products": one paginated GET /products
 * request scoped to the current product's category, not a client-side
 * filter over the whole catalog and not Math.random() sampling. Excludes
 * the current product itself and caps the result to 4 cards.
 */
export function useRelatedProducts(categoryId: string | undefined, excludeProductId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.products.related(categoryId ?? "none"),
    queryFn: ({ signal }) =>
      productsApi.list({ categoryId, limit: RELATED_FETCH_LIMIT, sortBy: "createdAt", sortOrder: "DESC" }, signal),
    enabled: Boolean(categoryId),
    staleTime: 30_000,
    retry: (failureCount, error) => isRetryableError(error) && failureCount < 2,
  });

  const items = (query.data?.items ?? []).filter((item) => item.id !== excludeProductId).slice(0, 4);

  return { items, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}
