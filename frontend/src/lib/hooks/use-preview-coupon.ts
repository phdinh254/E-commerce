"use client";

import { useMutation } from "@tanstack/react-query";
import { cartApi } from "@/lib/api/cart";

/**
 * A mutation, not a query — preview has a real side-effect-free server
 * round-trip per submit but no meaningful cache key to dedupe/reuse by
 * (the same code can resolve differently as the Cart changes). Never used
 * as evidence a Coupon was actually applied.
 */
export function usePreviewCoupon() {
  return useMutation({
    mutationFn: (code: string) => cartApi.previewCoupon(code),
  });
}
