import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { useUpdateCartItem } from "@/lib/hooks/use-update-cart-item";
import { useRemoveCartItem } from "@/lib/hooks/use-remove-cart-item";
import { CartContent } from "./cart-content";

vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("@/lib/hooks/use-update-cart-item", () => ({ useUpdateCartItem: vi.fn() }));
vi.mock("@/lib/hooks/use-remove-cart-item", () => ({ useRemoveCartItem: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUpdateCartItem).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as never);
  vi.mocked(useRemoveCartItem).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as never);
});

function mockAuth(status: "loading" | "authenticated" | "unauthenticated") {
  vi.mocked(useAuth).mockReturnValue({
    user: status === "authenticated" ? ({ id: "u1" } as never) : null,
    status,
    setUser: vi.fn(),
    logout: vi.fn(),
  });
}

describe("CartContent", () => {
  it("shows a loading state while auth status is resolving", () => {
    mockAuth("loading");
    vi.mocked(useCart).mockReturnValue({ isLoading: true } as never);

    render(<CartContent />);

    expect(screen.getByText(/đang tải/i)).toBeInTheDocument();
  });

  it("prompts login for a guest, without ever calling the cart query for data", () => {
    mockAuth("unauthenticated");
    vi.mocked(useCart).mockReturnValue({ isLoading: false, isError: false, data: undefined } as never);

    render(<CartContent />);

    expect(screen.getByText("Vui lòng đăng nhập")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fcart",
    );
  });

  it("shows a loading state while the cart query is loading", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ isLoading: true } as never);

    render(<CartContent />);

    expect(screen.getByText(/đang tải giỏ hàng/i)).toBeInTheDocument();
  });

  it("shows an error state with retry, distinct from empty", () => {
    mockAuth("authenticated");
    const refetch = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    } as never);

    render(<CartContent />);

    expect(screen.getByText("Không thể tải giỏ hàng")).toBeInTheDocument();
    expect(screen.queryByText("Giỏ hàng đang trống")).not.toBeInTheDocument();
  });

  it("shows the empty state only when the query succeeded with zero items", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { cartId: null, items: [], totalQuantity: 0, subtotal: 0, currency: "VND", updatedAt: null },
    } as never);

    render(<CartContent />);

    expect(screen.getByText("Giỏ hàng đang trống")).toBeInTheDocument();
  });

  it("renders cart items and subtotal when the cart has data", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        cartId: "c1",
        items: [
          { itemId: "i1", productId: "p1", variantId: null, productName: "Tai nghe", slug: "tai-nghe", sku: "SKU", image: null, selectedOptions: null, quantity: 1, unitPrice: 100_000, lineTotal: 100_000, available: true, unavailableReason: null },
        ],
        totalQuantity: 1,
        subtotal: 100_000,
        currency: "VND",
        updatedAt: null,
      },
    } as never);

    render(<CartContent />);

    expect(screen.getByText("Tai nghe")).toBeInTheDocument();
    expect(screen.queryByText("Giỏ hàng đang trống")).not.toBeInTheDocument();
  });
});
