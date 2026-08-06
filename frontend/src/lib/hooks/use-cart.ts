"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";

function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  return true;
}

const retry = (failureCount: number, error: unknown) =>
  isRetryableError(error) && failureCount < 2;

/**
 * Never fetches for a guest — Cart is authenticated-only (no guest cart),
 * and `enabled` waits for auth status to resolve past "loading" so a
 * pre-hydration render never fires a request that would 401 and get
 * mistaken for "cart is empty".
 */
export function useCart() {
  const { status } = useAuth();

  return useQuery({
    queryKey: queryKeys.cart.detail,
    queryFn: ({ signal }) => cartApi.getCart(signal),
    enabled: status === "authenticated",
    staleTime: 10_000,
    retry,
  });
}
