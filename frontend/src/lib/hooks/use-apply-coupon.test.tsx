import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import { useApplyCoupon } from "./use-apply-coupon";

vi.mock("@/lib/api/cart", () => ({ cartApi: { applyCoupon: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const CART_WITH_COUPON = {
  cartId: "c1",
  items: [],
  totalQuantity: 0,
  subtotal: 100_000,
  discountAmount: 10_000,
  total: 90_000,
  appliedCoupon: { code: "WELCOME10", name: null, discountType: "PERCENTAGE" as const, discountValue: 10 },
  couponRemovedReason: null,
  currency: "VND" as const,
  updatedAt: null,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useApplyCoupon", () => {
  it("calls cartApi.applyCoupon with the code and writes the response into the cart cache", async () => {
    vi.mocked(cartApi.applyCoupon).mockResolvedValue(CART_WITH_COUPON);
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useApplyCoupon(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("WELCOME10");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cartApi.applyCoupon).toHaveBeenCalledWith("WELCOME10");
    expect(client.getQueryData(queryKeys.cart.detail)).toEqual(CART_WITH_COUPON);
  });

  it("does not swallow errors (e.g. invalid coupon)", async () => {
    vi.mocked(cartApi.applyCoupon).mockRejectedValue(new Error("COUPON_EXPIRED"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApplyCoupon(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("X")).rejects.toThrow("COUPON_EXPIRED");
    });
  });
});
