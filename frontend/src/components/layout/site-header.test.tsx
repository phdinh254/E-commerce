import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { CartLink } from "./site-header";

vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/hooks/use-cart", () => ({ useCart: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

function mockAuth(status: "loading" | "authenticated" | "unauthenticated") {
  vi.mocked(useAuth).mockReturnValue({
    user: status === "authenticated" ? ({ id: "u1" } as never) : null,
    status,
    setUser: vi.fn(),
    logout: vi.fn(),
  });
}

describe("CartLink (header cart badge)", () => {
  it("shows no badge for a guest, and the link points to /cart (login happens on click via the cart page/panel flow)", () => {
    mockAuth("unauthenticated");
    vi.mocked(useCart).mockReturnValue({ data: undefined } as never);

    render(<CartLink />);

    const link = screen.getByRole("link", { name: "Giỏ hàng" });
    expect(link).toHaveAttribute("href", "/cart");
  });

  it("shows no badge while auth is loading (no hydration-mismatch-prone guess)", () => {
    mockAuth("loading");
    vi.mocked(useCart).mockReturnValue({ data: undefined } as never);

    render(<CartLink />);

    expect(screen.getByRole("link", { name: "Giỏ hàng" })).toBeInTheDocument();
  });

  it("hides the badge when totalQuantity is 0 for an authenticated user", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      data: { cartId: null, items: [], totalQuantity: 0, subtotal: 0, currency: "VND", updatedAt: null },
    } as never);

    render(<CartLink />);

    expect(screen.getByRole("link", { name: "Giỏ hàng" })).toBeInTheDocument();
  });

  it("shows the real totalQuantity as the badge and in the accessible name", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      data: { cartId: "c1", items: [], totalQuantity: 3, subtotal: 30000, currency: "VND", updatedAt: null },
    } as never);

    render(<CartLink />);

    expect(screen.getByRole("link", { name: "Giỏ hàng, 3 sản phẩm" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the displayed badge at 99+", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      data: { cartId: "c1", items: [], totalQuantity: 150, subtotal: 1, currency: "VND", updatedAt: null },
    } as never);

    render(<CartLink />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
