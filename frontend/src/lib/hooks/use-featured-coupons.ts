"use client";

import { useQuery } from "@tanstack/react-query";
import { couponsApi } from "@/lib/api/coupons";
import { queryKeys } from "@/lib/api/query-keys";

/** Public — no auth gating needed, same as browsing the catalog. */
export function useFeaturedCoupons(limit?: number) {
  return useQuery({
    queryKey: queryKeys.coupons.featured(limit),
    queryFn: ({ signal }) => couponsApi.getFeatured(limit, signal),
    staleTime: 60_000,
  });
}
