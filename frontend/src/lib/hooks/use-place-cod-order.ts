"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkoutApi } from "@/lib/api/checkout";
import { queryKeys } from "@/lib/api/query-keys";
import type { CheckoutPayload } from "@/types/payment";

/**
 * Each call to `mutate()` is one checkout intent and gets a fresh
 * Idempotency-Key, generated once per attempt (never regenerated on a
 * TanStack Query internal retry — there is none configured here, so this
 * is safe). On success the Cart query is invalidated: the backend consumed
 * it (CART -> PAID), so the cached Cart would otherwise keep showing stale
 * items.
 */
export function usePlaceCodOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutPayload) =>
      checkoutApi.placeCod(payload, crypto.randomUUID()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail });
    },
  });
}
