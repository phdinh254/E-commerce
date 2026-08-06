"use client";

import { useQuery, type Query } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { paymentsApi } from "@/lib/api/payments";
import { queryKeys } from "@/lib/api/query-keys";
import type { PaymentStatusResult } from "@/types/payment";

const POLL_INTERVAL_MS = 3_000;

function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  return true;
}

const retry = (failureCount: number, error: unknown) =>
  isRetryableError(error) && failureCount < 2;

/**
 * The return-URL page's only source of truth — never the redirect's query
 * string (PayOS's `status`/`orderCode` params are a UX hint at best, never
 * proof of payment; see payment-result/page.tsx). Polls at a fixed interval
 * ONLY while the last known status is non-terminal; the moment the backend
 * reports `isTerminal: true` (PAID/CANCELLED/EXPIRED/FAILED),
 * `refetchInterval` returns `false` and polling stops for good — a
 * terminal payment can never become non-terminal again (see
 * PaymentTransitionService's guard), so there's no case where polling
 * needs to resume.
 */
export function usePaymentStatus(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments.status(orderId ?? ""),
    queryFn: ({ signal }) => paymentsApi.getStatus(orderId as string, signal),
    enabled: Boolean(orderId),
    retry,
    refetchInterval: (query: Query<PaymentStatusResult>) =>
      query.state.data && query.state.data.isTerminal ? false : POLL_INTERVAL_MS,
  });
}
