import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { usePreviewCoupon } from "./use-preview-coupon";

vi.mock("@/lib/api/cart", () => ({ cartApi: { previewCoupon: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePreviewCoupon", () => {
  it("calls cartApi.previewCoupon with the given code and returns the result", async () => {
    vi.mocked(cartApi.previewCoupon).mockResolvedValue({
      code: "X",
      valid: true,
      discountType: "FIXED",
      discountValue: 10_000,
      subtotal: 100_000,
      discountAmount: 10_000,
      total: 90_000,
      reasonCode: null,
      message: "ok",
    });
    const { result } = renderHook(() => usePreviewCoupon(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("X");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cartApi.previewCoupon).toHaveBeenCalledWith("X");
  });

  it("does not swallow a rejected preview", async () => {
    vi.mocked(cartApi.previewCoupon).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => usePreviewCoupon(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("X")).rejects.toThrow("network");
    });
  });
});
