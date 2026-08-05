"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { productsApi } from "@/lib/api/products";
import { productVariantsApi } from "@/lib/api/product-variants";
import { productImagesApi } from "@/lib/api/product-images";
import { productOptionsApi } from "@/lib/api/product-options";
import { productAttributesApi } from "@/lib/api/product-attributes";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProductAttribute, ProductImage, ProductOption, ProductVariant } from "@/types/product-detail";

/** Never retries a 4xx (not found / bad request won't change on retry) — only network errors and 5xx. */
function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  return true;
}

const retry = (failureCount: number, error: unknown) => isRetryableError(error) && failureCount < 2;

/**
 * Composes the one product-detail page's data needs. The backend has no
 * single combined "detail" endpoint (see Ch14 audit notes in docs/catalog.md)
 * so this issues a small, fixed number of requests for exactly one product —
 * not a per-item fetch inside a list, so it does not reintroduce the N+1
 * pattern Ch13 avoided. The product itself is fetched first (its id is
 * required as the path parameter for the other three); the other three run
 * in parallel once that id is known.
 */
export function useProductDetail(slug: string) {
  const productQuery = useQuery({
    queryKey: queryKeys.products.detail(slug),
    queryFn: ({ signal }) => productsApi.getBySlug(slug, signal),
    enabled: slug.length > 0,
    staleTime: 30_000,
    retry,
  });

  const productId = productQuery.data?.id;

  const dependentQueries = useQueries({
    queries: [
      {
        queryKey: productId ? queryKeys.products.variants(productId) : queryKeys.products.variants("pending"),
        queryFn: ({ signal }: { signal: AbortSignal }) => productVariantsApi.list(productId as string, signal),
        enabled: Boolean(productId),
        staleTime: 30_000,
        retry,
      },
      {
        queryKey: productId ? queryKeys.products.images(productId) : queryKeys.products.images("pending"),
        queryFn: ({ signal }: { signal: AbortSignal }) => productImagesApi.list(productId as string, signal),
        enabled: Boolean(productId),
        // Signed URLs expire; keep this shorter-lived than the rest so a
        // long-open tab doesn't end up rendering an expired <img src>.
        staleTime: 60_000,
        retry,
      },
      {
        queryKey: productId ? queryKeys.products.options(productId) : queryKeys.products.options("pending"),
        queryFn: ({ signal }: { signal: AbortSignal }) => productOptionsApi.list(productId as string, signal),
        enabled: Boolean(productId),
        staleTime: 30_000,
        retry,
      },
      {
        queryKey: productId ? queryKeys.products.attributes(productId) : queryKeys.products.attributes("pending"),
        queryFn: ({ signal }: { signal: AbortSignal }) => productAttributesApi.list(productId as string, signal),
        enabled: Boolean(productId),
        staleTime: 30_000,
        retry,
      },
    ],
  }) as [
    ReturnType<typeof useQuery<ProductVariant[]>>,
    ReturnType<typeof useQuery<ProductImage[]>>,
    ReturnType<typeof useQuery<ProductOption[]>>,
    ReturnType<typeof useQuery<ProductAttribute[]>>,
  ];

  const [variantsQuery, imagesQuery, optionsQuery, attributesQuery] = dependentQueries;

  return {
    product: productQuery.data,
    variants: variantsQuery.data ?? [],
    images: imagesQuery.data ?? [],
    options: optionsQuery.data ?? [],
    attributes: attributesQuery.data ?? [],
    isProductLoading: productQuery.isLoading,
    isProductError: productQuery.isError,
    productErrorStatus: isAxiosError(productQuery.error) ? productQuery.error.response?.status : undefined,
    isDependentLoading: Boolean(productId) && dependentQueries.some((q) => q.isLoading),
    isDependentError: dependentQueries.some((q) => q.isError),
    refetchProduct: productQuery.refetch,
    refetchDependents: () => Promise.all(dependentQueries.map((q) => q.refetch())),
  };
}
