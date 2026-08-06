"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";

interface UpdateVars {
  itemId: string;
  quantity: number;
}

function recomputeTotals(cart: Cart): Cart {
  const totalQuantity = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { ...cart, totalQuantity, subtotal };
}

/**
 * Optimistic absolute-quantity update. The calling component (CartItem) is
 * responsible for disabling that line's controls while its own mutation is
 * pending — that, plus TanStack Query's per-key cache being the single
 * source of truth reconciled in onSettled, is what prevents an
 * out-of-order stale response from clobbering a newer one for the same
 * line (see plan §21).
 */
export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, quantity }: UpdateVars) =>
      cartApi.updateItemQuantity(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.detail });
      const previous = queryClient.getQueryData<Cart>(queryKeys.cart.detail);

      if (previous) {
        const optimistic = recomputeTotals({
          ...previous,
          items: previous.items.map((item) =>
            item.itemId === itemId
              ? { ...item, quantity, lineTotal: item.unitPrice * quantity }
              : item,
          ),
        });
        queryClient.setQueryData(queryKeys.cart.detail, optimistic);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.cart.detail, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail });
    },
  });
}
