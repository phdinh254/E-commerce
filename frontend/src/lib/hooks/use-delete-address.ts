"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";

/** Deleting the default address promotes a replacement server-side —
 * invalidate-and-refetch is what picks that up, not an optimistic local
 * filter. */
export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressId: string) => addressesApi.remove(addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
    },
  });
}
