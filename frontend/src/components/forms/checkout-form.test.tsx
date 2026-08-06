import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { useAddresses } from "@/lib/hooks/use-addresses";
import { usePlaceCodOrder } from "@/lib/hooks/use-place-cod-order";
import { usePlacePayOsOrder } from "@/lib/hooks/use-place-payos-order";
import { CheckoutForm } from "./checkout-form";
import type { Address } from "@/types/address";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("@/lib/hooks/use-addresses", () => ({ useAddresses: vi.fn() }));
vi.mock("@/lib/hooks/use-place-cod-order", () => ({ usePlaceCodOrder: vi.fn() }));
vi.mock("@/lib/hooks/use-place-payos-order", () => ({ usePlacePayOsOrder: vi.fn() }));
// AddressFormDialog has its own dedicated test file — stubbed here so this
// file stays focused on CheckoutForm's own selection/submit logic.
vi.mock("@/components/commerce/address-form-dialog", () => ({
  AddressFormDialog: () => null,
}));

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

const DEFAULT_ADDRESS: Address = {
  id: "address-1",
  label: "Nhà riêng",
  recipientName: "Nguyen Van A",
  phoneNumber: "0912345678",
  province: "Ha Noi",
  district: "Cau Giay",
  ward: "Dich Vong",
  streetAddress: "123 Xuan Thuy",
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SECOND_ADDRESS: Address = {
  ...DEFAULT_ADDRESS,
  id: "address-2",
  label: "Công ty",
  recipientName: "Tran Thi B",
  isDefault: false,
};

function mockAddresses(addresses: Address[], isLoading = false) {
  vi.mocked(useAddresses).mockReturnValue({ data: addresses, isLoading } as never);
}

describe("CheckoutForm", () => {
  it("redirects to login and renders no checkout content when unauthenticated", () => {
    mockAuth("unauthenticated");
    vi.mocked(useCart).mockReturnValue({ data: undefined, isLoading: false } as never);
    mockAddresses([]);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(replace).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent("/checkout")}`);
    expect(screen.queryByText("Địa chỉ nhận hàng")).not.toBeInTheDocument();
  });

  it("renders order summary totals from the real cart, never hardcoded values", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([DEFAULT_ADDRESS]);
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
    mockAddresses([DEFAULT_ADDRESS]);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(screen.getByText("Giỏ hàng của bạn đang trống, không thể thanh toán.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thanh toán với PayOS/ })).toBeDisabled();
  });

  it("disables the submit button and shows a message when the user has no saved address", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([]);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    expect(
      screen.getByText("Bạn chưa có địa chỉ giao hàng nào. Vui lòng thêm một địa chỉ để tiếp tục."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thanh toán với PayOS/ })).toBeDisabled();
  });

  it("preselects the default address", () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([SECOND_ADDRESS, DEFAULT_ADDRESS]);
    vi.mocked(usePlaceCodOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(usePlacePayOsOrder).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<CheckoutForm />);

    const label = screen.getByText(/Nguyen Van A/).closest("label");
    const radio = within(label as HTMLElement).getByRole("radio");
    expect(radio).toHaveAttribute("aria-checked", "true");
  });

  it("submits the selected addressId for COD and navigates to the payment-result page with orderId", async () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([DEFAULT_ADDRESS]);
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
    await user.click(screen.getByText("Thanh toán khi nhận hàng (COD)"));
    await user.click(screen.getByRole("button", { name: /Đặt hàng \(COD\)/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({ addressId: "address-1", shippingNote: undefined });
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("recipientName");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/payment-result?orderId=order-1"));
  });

  it("submits the non-default address once explicitly selected", async () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([DEFAULT_ADDRESS, SECOND_ADDRESS]);
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
    await user.click(screen.getByText(/Tran Thi B/));
    await user.click(screen.getByText("Thanh toán khi nhận hàng (COD)"));
    await user.click(screen.getByRole("button", { name: /Đặt hàng \(COD\)/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ addressId: "address-2", shippingNote: undefined });
  });

  it("redirects the browser to the PayOS checkoutUrl on success, without calling router.push", async () => {
    mockAuth("authenticated");
    vi.mocked(useCart).mockReturnValue({ data: CART, isLoading: false } as never);
    mockAddresses([DEFAULT_ADDRESS]);
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
    await user.click(screen.getByRole("button", { name: /Thanh toán với PayOS/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("https://pay.payos.vn/web/abc"));
    expect(push).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
