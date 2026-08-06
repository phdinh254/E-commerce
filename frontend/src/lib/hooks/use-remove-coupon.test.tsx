import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";
import { useRemoveCoupon } from "./use-remove-coupon";

vi.mock("@/lib/api/cart", () => ({ cartApi: { removeCoupon: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const INITIAL: Cart = {
  cartId: "c1",
  items: [],
  totalQuantity: 0,
  subtotal: 100_000,
  discountAmount: 10_000,
  total: 90_000,
  appliedCoupon: { code: "WELCOME10", name: null, discountType: "PERCENTAGE", discountValue: 10 },
  couponRemovedReason: null,
  currency: "VND",
  updatedAt: null,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.cart.detail, INITIAL);
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useRemoveCoupon", () => {
  it("optimistically clears appliedCoupon/discountAmount and sets total = subtotal", async () => {
    vi.mocked(cartApi.removeCoupon).mockReturnValue(new Promise(() => {}));
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useRemoveCoupon(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
      expect(cart?.appliedCoupon).toBeNull();
    });
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.discountAmount).toBe(0);
    expect(cart?.total).toBe(cart?.subtotal);
  });

  it("rolls back to the previous applied coupon on error", async () => {
    vi.mocked(cartApi.removeCoupon).mockRejectedValue(new Error("network"));
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useRemoveCoupon(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.appliedCoupon).toEqual(INITIAL.appliedCoupon);
  });

  it("reconciles with the server response on success", async () => {
    const serverCart: Cart = { ...INITIAL, appliedCoupon: null, discountAmount: 0, total: INITIAL.subtotal };
    vi.mocked(cartApi.removeCoupon).mockResolvedValue(serverCart);
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useRemoveCoupon(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(queryKeys.cart.detail)).toEqual(serverCart);
  });
});
