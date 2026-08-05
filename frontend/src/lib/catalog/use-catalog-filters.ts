"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CatalogFilters,
  type CatalogSortOption,
  parseCatalogSearchParams,
  serializeCatalogFilters,
} from "@/lib/catalog/search-params";

type HistoryMode = "push" | "replace";

/**
 * The URL is the single source of truth for applied catalog filters — this
 * hook never keeps its own copy of filter state. `filters` is derived via
 * `useMemo` straight from `useSearchParams()` on every render, so Back/
 * Forward and a manually-edited URL are reflected automatically with no
 * extra wiring.
 *
 * `history: "replace"` is used for the search box's debounced commits (so
 * Back isn't flooded with one entry per keystroke-batch); `"push"` is used
 * for everything a user would reasonably want to Back out of — category,
 * price, sort, clearing a filter.
 */
export function useCatalogFilters(): {
  filters: CatalogFilters;
  setFilters: (patch: Partial<CatalogFilters>, mode?: HistoryMode) => void;
  setSearch: (q: string, mode?: HistoryMode) => void;
  setCategory: (categorySlug: string | null) => void;
  setPriceRange: (minPrice: number | null, maxPrice: number | null) => void;
  setSort: (sort: CatalogSortOption | null) => void;
  clearFilter: (key: keyof CatalogFilters) => void;
  clearAllFilters: () => void;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseCatalogSearchParams(searchParams), [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<CatalogFilters>, mode: HistoryMode = "push") => {
      const next = serializeCatalogFilters({ ...filters, ...patch }, searchParams);
      const query = next.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      const navigate = mode === "replace" ? router.replace : router.push;
      navigate(url, { scroll: false });
    },
    [filters, pathname, router, searchParams],
  );

  const setSearch = useCallback(
    (q: string, mode: HistoryMode = "replace") => setFilters({ q }, mode),
    [setFilters],
  );
  const setCategory = useCallback(
    (categorySlug: string | null) => setFilters({ categorySlug }),
    [setFilters],
  );
  const setPriceRange = useCallback(
    (minPrice: number | null, maxPrice: number | null) => setFilters({ minPrice, maxPrice }),
    [setFilters],
  );
  const setSort = useCallback(
    (sort: CatalogSortOption | null) => setFilters({ sort }),
    [setFilters],
  );
  const clearFilter = useCallback(
    (key: keyof CatalogFilters) => {
      if (key === "minPrice" || key === "maxPrice") {
        setFilters({ minPrice: null, maxPrice: null });
        return;
      }
      setFilters({ [key]: key === "q" ? "" : null } as Partial<CatalogFilters>);
    },
    [setFilters],
  );
  const clearAllFilters = useCallback(
    () => setFilters({ q: "", categorySlug: null, minPrice: null, maxPrice: null }),
    [setFilters],
  );

  return { filters, setFilters, setSearch, setCategory, setPriceRange, setSort, clearFilter, clearAllFilters };
}
