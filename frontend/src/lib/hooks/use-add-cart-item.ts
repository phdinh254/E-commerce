"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { AddCartItemPayload } from "@/types/cart";

/**
 * Not optimistic (unlike update/remove): price is server-resolved, so an
 * optimistic add would have to guess it, contradicting "backend owns
 * price". Each call to `mutate()` is one user intent and gets a fresh
 * Idempotency-Key — the mutation button being disabled while `isPending`
 * (see ProductPurchasePanel) is what prevents an accidental double-submit
 * from becoming two intents; a genuine retry after failure is a new,
 * separate intent and correctly gets its own key.
 */
export function useAddCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddCartItemPayload) =>
      cartApi.addItem(payload, crypto.randomUUID()),
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart.detail, cart);
    },
  });
}
