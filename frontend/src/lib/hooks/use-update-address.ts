"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateAddressPayload } from "@/types/address";

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ addressId, payload }: { addressId: string; payload: UpdateAddressPayload }) =>
      addressesApi.update(addressId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
    },
  });
}
