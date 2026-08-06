"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkoutApi } from "@/lib/api/checkout";
import { queryKeys } from "@/lib/api/query-keys";
import type { CheckoutPayload } from "@/types/payment";

/** Same idempotency/cache-invalidation contract as usePlaceCodOrder — see
 * that hook's comment. Caller is responsible for redirecting to
 * `checkoutUrl` on success; this hook never navigates itself. */
export function usePlacePayOsOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutPayload) =>
      checkoutApi.placePayOs(payload, crypto.randomUUID()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail });
    },
  });
}
