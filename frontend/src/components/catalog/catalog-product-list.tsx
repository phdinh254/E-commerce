"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";
import { useInfiniteProducts } from "@/lib/hooks/use-infinite-products";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";
import { catalogFiltersHaveActiveFilter } from "@/lib/catalog/search-params";
import { useCategories } from "@/lib/hooks/use-categories";
import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import {
  CatalogEmptyState,
  CatalogInitialError,
  CatalogNextPageError,
  CatalogProductGridSkeleton,
} from "@/components/catalog/catalog-states";
import type { CatalogProduct } from "@/types/catalog";

export function CatalogProductList() {
  const { filters, clearAllFilters } = useCatalogFilters();
  const categoriesQuery = useCategories();
  const categorySlugToId = useMemo(() => {
    if (!categoriesQuery.data) return null;
    return new Map(categoriesQuery.data.map((c) => [c.slug, c.id]));
  }, [categoriesQuery.data]);

  const query = useInfiniteProducts(filters, categorySlugToId);
  const {
    data,
    isPending,
    isError,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = query;

  // A next-page failure still leaves `data` populated with whatever pages
  // already succeeded — only an initial-load failure (no data at all) is
  // a full-page error. This is what keeps a next-page error from wiping
  // out products the user already scrolled through.
  const isInitialError = isError && !data;

  // Defensive de-duplication by id — never masks a real backend pagination
  // bug (if pages genuinely overlap under filter changes that race with
  // in-flight fetches, that's the invariant this list itself protects
  // against via the query key including every filter), but guards against
  // a double-render or a fast filter round-trip briefly showing the same
  // page twice.
  const products = useMemo<CatalogProduct[]>(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const result: CatalogProduct[] = [];
    for (const page of data.pages) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
      }
    }
    return result;
  }, [data]);

  const sentinelRef = useIntersectionObserver(() => fetchNextPage(), {
    enabled: Boolean(hasNextPage) && !isFetchingNextPage && !isFetchNextPageError,
  });

  if (isPending) {
    return <CatalogProductGridSkeleton />;
  }

  if (isInitialError) {
    return <CatalogInitialError onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  if (products.length === 0) {
    return (
      <CatalogEmptyState
        hasActiveFilter={catalogFiltersHaveActiveFilter(filters)}
        onClearFilters={clearAllFilters}
      />
    );
  }

  return (
    <div>
      <div
        className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {products.map((product) => (
          <CatalogProductCard key={product.id} product={product} />
        ))}
      </div>

      {isFetchNextPageError ? (
        <CatalogNextPageError onRetry={() => fetchNextPage()} isRetrying={isFetchingNextPage} />
      ) : hasNextPage ? (
        <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-4">
          {isFetchingNextPage ? (
            <CatalogProductGridSkeleton count={4} />
          ) : (
            <Button type="button" variant="outline" size="lg" onClick={() => fetchNextPage()}>
              Xem thêm sản phẩm
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-10 text-center text-sm text-muted-foreground">Đã hiển thị toàn bộ sản phẩm.</p>
      )}
    </div>
  );
}
