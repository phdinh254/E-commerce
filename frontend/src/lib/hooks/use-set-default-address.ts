"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressId: string) => addressesApi.setDefault(addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
    },
  });
}
