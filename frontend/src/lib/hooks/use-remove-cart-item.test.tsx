import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";
import { useRemoveCartItem } from "./use-remove-cart-item";

vi.mock("@/lib/api/cart", () => ({ cartApi: { removeItem: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const INITIAL: Cart = {
  cartId: "cart-1",
  items: [
    { itemId: "i1", productId: "p1", variantId: null, productName: "X", slug: "x", sku: "SKU", image: null, selectedOptions: null, quantity: 2, unitPrice: 1000, lineTotal: 2000, available: true, unavailableReason: null },
    { itemId: "i2", productId: "p2", variantId: null, productName: "Y", slug: "y", sku: "SKU2", image: null, selectedOptions: null, quantity: 1, unitPrice: 500, lineTotal: 500, available: true, unavailableReason: null },
  ],
  totalQuantity: 3,
  subtotal: 2500,
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

describe("useRemoveCartItem", () => {
  it("optimistically removes only the targeted line and recomputes totals", async () => {
    vi.mocked(cartApi.removeItem).mockReturnValue(new Promise(() => {}));
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useRemoveCartItem(), { wrapper });

    act(() => {
      result.current.mutate("i1");
    });

    await waitFor(() => {
      const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
      expect(cart?.items).toHaveLength(1);
    });
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.items[0]?.itemId).toBe("i2");
    expect(cart?.totalQuantity).toBe(1);
    expect(cart?.subtotal).toBe(500);
  });

  it("rolls back (item reappears) on error", async () => {
    vi.mocked(cartApi.removeItem).mockRejectedValue(new Error("network"));
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useRemoveCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate("i1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.items).toHaveLength(2);
  });
});
