"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";

function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  return true;
}

const retry = (failureCount: number, error: unknown) =>
  isRetryableError(error) && failureCount < 2;

/** Never fetches for a guest — Address is authenticated-only, same guard
 * pattern as useCart/useProfile. */
export function useAddresses() {
  const { status } = useAuth();

  return useQuery({
    queryKey: queryKeys.addresses.all,
    queryFn: ({ signal }) => addressesApi.list(signal),
    enabled: status === "authenticated",
    staleTime: 10_000,
    retry,
  });
}
