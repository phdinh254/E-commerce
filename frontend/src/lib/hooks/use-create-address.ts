"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import type { AddressPayload } from "@/types/address";

/** Invalidates the full list on success rather than patching the cache —
 * the backend may have silently changed OTHER rows too (a new default
 * clears the previous one), so a full refetch is the only way to stay
 * correct without duplicating that server-side logic on the client. */
export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddressPayload) => addressesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
    },
  });
}
