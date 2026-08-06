import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import { useAddCartItem } from "./use-add-cart-item";

vi.mock("@/lib/api/cart", () => ({ cartApi: { addItem: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const CART = {
  cartId: "cart-1",
  items: [{ itemId: "i1", productId: "p1", variantId: null, productName: "X", slug: "x", sku: "SKU", image: null, selectedOptions: null, quantity: 1, unitPrice: 1000, lineTotal: 1000, available: true, unavailableReason: null }],
  totalQuantity: 1,
  subtotal: 1000,
  discountAmount: 0,
  total: 1000,
  appliedCoupon: null,
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

describe("useAddCartItem", () => {
  it("generates a fresh Idempotency-Key per call and updates the cart cache on success", async () => {
    vi.mocked(cartApi.addItem).mockResolvedValue(CART);
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useAddCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate({ productId: "p1", quantity: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, key1] = vi.mocked(cartApi.addItem).mock.calls[0] as [unknown, string];
    expect(typeof key1).toBe("string");
    expect(key1.length).toBeGreaterThan(0);
    expect(client.getQueryData(queryKeys.cart.detail)).toEqual(CART);
  });

  it("uses a different key for two separate mutate() calls", async () => {
    vi.mocked(cartApi.addItem).mockResolvedValue(CART);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAddCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate({ productId: "p1", quantity: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      result.current.mutate({ productId: "p1", quantity: 1 });
    });
    await waitFor(() => expect(cartApi.addItem).toHaveBeenCalledTimes(2));

    const [, keyA] = vi.mocked(cartApi.addItem).mock.calls[0] as [unknown, string];
    const [, keyB] = vi.mocked(cartApi.addItem).mock.calls[1] as [unknown, string];
    expect(keyA).not.toBe(keyB);
  });

  it("does not swallow errors", async () => {
    vi.mocked(cartApi.addItem).mockRejectedValue(new Error("VARIANT_REQUIRED"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAddCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate({ productId: "p1", quantity: 1 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
