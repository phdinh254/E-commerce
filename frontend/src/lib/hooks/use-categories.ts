"use client";

import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api/categories";
import { queryKeys } from "@/lib/api/query-keys";
import type { Category } from "@/types/catalog";

/**
 * One shared query for the whole catalog page — the desktop sidebar and
 * the mobile filter drawer both call this hook and hit the same
 * TanStack Query cache entry, so category data is fetched once, not once
 * per surface (see Ch13 perf notes: "Một nguồn Category query dùng chung").
 */
export function useCategories(): ReturnType<typeof useQuery<Category[]>> {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async ({ signal }) => (await categoriesApi.list(signal)).items,
    staleTime: 5 * 60_000,
  });
}
