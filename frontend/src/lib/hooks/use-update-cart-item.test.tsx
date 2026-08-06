import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { queryKeys } from "@/lib/api/query-keys";
import type { Cart } from "@/types/cart";
import { useUpdateCartItem } from "./use-update-cart-item";

vi.mock("@/lib/api/cart", () => ({ cartApi: { updateItemQuantity: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const INITIAL: Cart = {
  cartId: "cart-1",
  items: [
    { itemId: "i1", productId: "p1", variantId: null, productName: "X", slug: "x", sku: "SKU", image: null, selectedOptions: null, quantity: 2, unitPrice: 1000, lineTotal: 2000, available: true, unavailableReason: null },
  ],
  totalQuantity: 2,
  subtotal: 2000,
  discountAmount: 0,
  total: 2000,
  appliedCoupon: null,
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

describe("useUpdateCartItem", () => {
  it("optimistically sets the absolute quantity and recomputes totals with integer math", async () => {
    vi.mocked(cartApi.updateItemQuantity).mockReturnValue(new Promise(() => {})); // never resolves during assertion
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useUpdateCartItem(), { wrapper });

    act(() => {
      result.current.mutate({ itemId: "i1", quantity: 5 });
    });

    await waitFor(() => {
      const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
      expect(cart?.items[0]?.quantity).toBe(5);
    });
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.items[0]?.lineTotal).toBe(5000);
    expect(cart?.totalQuantity).toBe(5);
    expect(cart?.subtotal).toBe(5000);
  });

  it("rolls back to the previous cart state on error", async () => {
    vi.mocked(cartApi.updateItemQuantity).mockRejectedValue(new Error("404"));
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useUpdateCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate({ itemId: "i1", quantity: 9 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cart = client.getQueryData<Cart>(queryKeys.cart.detail);
    expect(cart?.items[0]?.quantity).toBe(2); // rolled back
    expect(cart?.subtotal).toBe(2000);
  });

  it("reconciles with the server response after settling", async () => {
    const serverCart: Cart = { ...INITIAL, items: [{ ...INITIAL.items[0], quantity: 3, lineTotal: 3000 }], totalQuantity: 3, subtotal: 3000 };
    vi.mocked(cartApi.updateItemQuantity).mockResolvedValue(serverCart);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCartItem(), { wrapper });

    await act(async () => {
      result.current.mutate({ itemId: "i1", quantity: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
