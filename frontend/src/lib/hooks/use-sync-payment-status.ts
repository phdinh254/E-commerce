"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/lib/api/payments";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * Manual "check now" fallback for when the webhook hasn't landed yet (e.g.
 * user returns from PayOS before the webhook arrives). Writes the fresh
 * result straight into the `usePaymentStatus` query cache so polling picks
 * up the new status immediately instead of waiting for its own interval.
 */
export function useSyncPaymentStatus(orderId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => paymentsApi.syncStatus(paymentId),
    onSuccess: (result) => {
      if (orderId) {
        queryClient.setQueryData(queryKeys.payments.status(orderId), result);
      }
    },
  });
}
