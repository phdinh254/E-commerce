import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "./use-cart";

vi.mock("@/lib/api/cart", () => ({ cartApi: { getCart: vi.fn() } }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const CART = {
  cartId: "cart-1",
  items: [],
  totalQuantity: 0,
  subtotal: 0,
  currency: "VND" as const,
  updatedAt: null,
};

describe("useCart", () => {
  it("does not call the Cart API while auth status is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "loading",
      setUser: vi.fn(),
      logout: vi.fn(),
    });

    renderHook(() => useCart(), { wrapper });

    expect(cartApi.getCart).not.toHaveBeenCalled();
  });

  it("does not call the Cart API for a guest (unauthenticated)", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "unauthenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });

    renderHook(() => useCart(), { wrapper });

    expect(cartApi.getCart).not.toHaveBeenCalled();
  });

  it("fetches the cart once authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", email: "a@b.com", role: "CUSTOMER" } as never,
      status: "authenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(cartApi.getCart).mockResolvedValue(CART);

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(CART));
  });
});
