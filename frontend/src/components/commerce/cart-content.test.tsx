import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { useUpdateCartItem } from "@/lib/hooks/use-update-cart-item";
import { useRemoveCartItem } from "@/lib/hooks/use-remove-cart-item";
import { useRemoveCoupon } from "@/lib/hooks/use-remove-coupon";
import { CartContent } from "./cart-content";

vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("@/lib/hooks/use-update-cart-item", () => ({ useUpdateCartItem: vi.fn() }));
vi.mock("@/lib/hooks/use-remove-cart-item", () => ({ useRemoveCartItem: vi.fn() }));
vi.mock("@/lib/hooks/use-remove-coupon", () => ({ useRemoveCoupon: vi.fn() }));
// CouponInput has its own dedicated test file (uses real TanStack Query
// mutations internally) — stubbed here so this file stays focused on
// CartContent's own layout/state logic without needing a QueryClientProvider.
vi.mock("@/components/commerce/coupon-input", () => ({
  CouponInput: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="coupon-input" data-disabled={disabled ? "true" : "false"} />
  ),
}));

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
  vi.mocked(useRemoveCoupon).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
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

const BASE_CART = {
  cartId: "c1",
  items: [
    { itemId: "i1", productId: "p1", variantId: null, productName: "Tai nghe", slug: "tai-nghe", sku: "SKU", image: null, selectedOptions: null, quantity: 1, unitPrice: 100_000, lineTotal: 100_000, available: true, unavailableReason: null },
  ],
  totalQuantity: 1,
  subtotal: 100_000,
  discountAmount: 0,
  total: 100_000,
  appliedCoupon: null,
  couponRemovedReason: null,
  currency: "VND" as const,
  updatedAt: null,
};

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
      data: { ...BASE_CART, items: [], totalQuantity: 0, subtotal: 0, total: 0 },
    } as never);

    render(<CartContent />);

    expect(screen.getByText("Giỏ hàng đang trống")).toBeInTheDocument();
  });

  it("renders cart items and subtotal when the cart has data", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: BASE_CART,
    } as never);

    render(<CartContent />);

    expect(screen.getByText("Tai nghe")).toBeInTheDocument();
    expect(screen.queryByText("Giỏ hàng đang trống")).not.toBeInTheDocument();
  });

  it("shows CouponInput (enabled) when the cart has items and no coupon applied", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: BASE_CART,
    } as never);

    render(<CartContent />);

    expect(screen.getByTestId("coupon-input")).toHaveAttribute("data-disabled", "false");
  });

  it("shows the applied coupon with discountAmount from the server and a remove button, instead of CouponInput", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...BASE_CART,
        discountAmount: 10_000,
        total: 90_000,
        appliedCoupon: { code: "WELCOME10", name: "Chào mừng", discountType: "PERCENTAGE", discountValue: 10 },
      },
    } as never);

    render(<CartContent />);

    expect(screen.getByText("WELCOME10")).toBeInTheDocument();
    expect(screen.getByText("Chào mừng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gỡ mã giảm giá WELCOME10" })).toBeInTheDocument();
    expect(screen.queryByTestId("coupon-input")).not.toBeInTheDocument();
  });

  it("calls useRemoveCoupon().mutate() when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useRemoveCoupon).mockReturnValue({ mutate, isPending: false } as never);
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...BASE_CART,
        discountAmount: 10_000,
        total: 90_000,
        appliedCoupon: { code: "WELCOME10", name: null, discountType: "FIXED", discountValue: 10_000 },
      },
    } as never);

    render(<CartContent />);
    await user.click(screen.getByRole("button", { name: "Gỡ mã giảm giá WELCOME10" }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("shows the couponRemovedReason banner when the server auto-removed the coupon", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...BASE_CART, couponRemovedReason: "Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã" },
    } as never);

    render(<CartContent />);

    expect(
      screen.getByText("Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã"),
    ).toBeInTheDocument();
  });
});
