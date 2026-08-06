"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * Not optimistic — discountAmount is server-computed and the request body
 * carries only `{code}`, so there is nothing meaningful to guess client-side.
 * On success, the server's Cart response becomes the new cache value
 * directly (no separate invalidate+refetch round trip).
 */
export function useApplyCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart.detail, cart);
    },
  });
}
