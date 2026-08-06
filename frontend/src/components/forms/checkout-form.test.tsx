import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { usePlaceCodOrder } from "@/lib/hooks/use-place-cod-order";
import { usePlacePayOsOrder } from "@/lib/hooks/use-place-payos-order";
import { CheckoutForm } from "./checkout-form";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("@/lib/hooks/use-place-cod-order", () => ({ usePlaceCodOrder: vi.fn() }));
vi.mock("@/lib/hooks/use-place-payos-order", () => ({ usePlacePayOsOrder: vi.fn() }));

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

const CART = {
  cartId: "cart-1",
  items: [
    {
      itemId: "i1",
      productId: "p1",
      variantId: null,
      productName: "Áo thun",
      slug: "ao-thun",
      sku: "SKU",
      image: null,
      selectedOptions: null,
      quantity: 2,
      unitPrice: 100_000,
      lineTotal: 200_000,
      available: true,
      unavailableReason: null,
    },
  ],
  totalQuantity: 2,
  subtotal: 200_000,
  discountAmount: 20_000,
  total: 180_000,
  appliedCoupon: null,
  couponRemovedReason: null,
  currency: "VND" as const,
  updatedAt: null,
};

async function fillShippingFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Họ và tên"), "Nguyen Van A");
  await user.type(screen.getByLabelText("Số điện thoại"), "0912345678");
  await user.type(screen.getByLabelText("Tỉnh hoặc thành phố"), "Ha Noi");
  await user.type(screen.getByLabelText("Quận hoặc huyện"), "Cau Giay");
  await user.type(screen.getByLabelText("Phường hoặc xã"), "Dich Vong");
  await user.type(screen.getByLabelText("Địa chỉ chi tiết"), "123 Xuan Thuy");
}

describe("CheckoutForm", () => {
  it("redirects to login and renders no checkout content when unauthenticated", () => {
    mockAuth("unauthenticated");
    vi.mocked(useCart).mockReturnValue({ data: undefined, isLoading: false } as never);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(replace).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent("/checkout")}`);
    expect(screen.queryByLabelText("Họ và tên")).not.toBeInTheDocument();
  });

  it("renders order summary totals from the real cart, never hardcoded values", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(screen.getByText("200.000 ₫")).toBeInTheDocument(); // subtotal
    expect(screen.getByText("180.000 ₫")).toBeInTheDocument(); // total
  });

  it("disables the submit button and shows a message when the cart is empty", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({
      data: { ...CART, items: [], subtotal: 0, discountAmount: 0, total: 0 },
      isLoading: false,
    } as never);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(screen.getByText("Giỏ hàng của bạn đang trống, không thể thanh toán.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thanh toán với PayOS/ })).toBeDisabled();
  });

  it("submits only shipping fields for COD and navigates to the payment-result page with orderId", async () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({
      orderId: "order-1",
      paymentId: "payment-1",
      paymentMethod: "COD",
      paymentStatus: "PAID",
      checkoutUrl: null,
    });
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<CheckoutForm />);
    await fillShippingFields(user);
    await user.click(screen.getByText("Thanh toán khi nhận hàng (COD)"));
    await user.click(screen.getByRole("button", { name: /Đặt hàng \(COD\)/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({
      shippingRecipientName: "Nguyen Van A",
      shippingPhoneNumber: "0912345678",
      shippingProvince: "Ha Noi",
      shippingDistrict: "Cau Giay",
      shippingWard: "Dich Vong",
      shippingStreetAddress: "123 Xuan Thuy",
      shippingNote: undefined,
    });
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("paymentMethod");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/payment-result?orderId=order-1"));
  });

  it("redirects the browser to the PayOS checkoutUrl on success, without calling router.push", async () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({
      orderId: "order-1",
      paymentId: "payment-1",
      paymentMethod: "PAYOS",
      paymentStatus: "PENDING",
      checkoutUrl: "https://pay.payos.vn/web/abc",
    });
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync, isPending: false } as never);
    const assignSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: assignSpy });

    const user = userEvent.setup();
    render(<CheckoutForm />);
    await fillShippingFields(user);
    await user.click(screen.getByRole("button", { name: /Thanh toán với PayOS/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("https://pay.payos.vn/web/abc"));
    expect(push).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
