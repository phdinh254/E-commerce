"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { profileApi } from "@/lib/api/profile";
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

/** Same guard pattern as useCart — never fetches until auth status is
 * resolved past "loading", so a pre-hydration render can't fire a request
 * that would 401. */
export function useProfile() {
  const { status } = useAuth();

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: ({ signal }) => profileApi.getProfile(signal),
    enabled: status === "authenticated",
    staleTime: 10_000,
    retry,
  });
}
