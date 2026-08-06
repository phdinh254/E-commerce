"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";

export function useRemoveCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.detail });
      const previous = queryClient.getQueryData<Cart>(queryKeys.cart.detail);

      if (previous) {
        queryClient.setQueryData<Cart>(queryKeys.cart.detail, {
          ...previous,
          appliedCoupon: null,
          discountAmount: 0,
          total: previous.subtotal,
          couponRemovedReason: null,
        });
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.cart.detail, context.previous);
      }
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart.detail, cart);
    },
  });
}
