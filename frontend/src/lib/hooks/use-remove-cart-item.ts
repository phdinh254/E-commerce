"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";

/** See use-update-cart-item.ts's recomputeTotals — same best-effort
 * discountAmount carry-forward, reconciled by onSettled's invalidate. */
function recomputeTotals(cart: Cart): Cart {
  const totalQuantity = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.items.reduce((sum, i) => sum + i.lineTotal, 0);
  const discountAmount = Math.min(cart.discountAmount, subtotal);
  return { ...cart, totalQuantity, subtotal, discountAmount, total: subtotal - discountAmount };
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.detail });
      const previous = queryClient.getQueryData<Cart>(queryKeys.cart.detail);

      if (previous) {
        const optimistic = recomputeTotals({
          ...previous,
          items: previous.items.filter((item) => item.itemId !== itemId),
        });
        queryClient.setQueryData(queryKeys.cart.detail, optimistic);
      }

      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.cart.detail, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail });
    },
  });
}
