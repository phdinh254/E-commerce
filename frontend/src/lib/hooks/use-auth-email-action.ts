"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";

const DEFAULT_COOLDOWN_MS = 30_000;

export interface UseAuthEmailActionResult<TInput> {
  run: (input: TInput) => void;
  isPending: boolean;
  isCoolingDown: boolean;
  isSuccess: boolean;
  successMessage: string | null;
  errorMessage: string | null;
}

/**
 * Wraps a single Auth API call (forgot-password, resend-verification, ...)
 * with loading/success/error state and a client-side cooldown so users
 * can't hammer the submit button — the backend throttles these endpoints
 * too, this just keeps the UI from firing requests it knows will 429/be
 * dropped, and avoids state updates after the component unmounts.
 */
export function useAuthEmailAction<TInput>(
  action: (input: TInput) => Promise<{ message: string }>,
  cooldownMs: number = DEFAULT_COOLDOWN_MS,
): UseAuthEmailActionResult<TInput> {
  const mountedRef = useRef(true);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => {
      if (!mountedRef.current) return;
      setIsCoolingDown(true);
      window.setTimeout(() => {
        if (mountedRef.current) setIsCoolingDown(false);
      }, cooldownMs);
    },
  });

  return {
    run: (input: TInput) => {
      if (mutation.isPending || isCoolingDown) return;
      mutation.mutate(input);
    },
    isPending: mutation.isPending,
    isCoolingDown,
    isSuccess: mutation.isSuccess,
    successMessage: mutation.data?.message ?? null,
    errorMessage: mutation.error ? getApiErrorMessage(mutation.error) : null,
  };
}
