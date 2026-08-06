import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartApi } from "@/lib/api/cart";
import { CouponInput } from "./coupon-input";

vi.mock("@/lib/api/cart", () => ({
  cartApi: { previewCoupon: vi.fn(), applyCoupon: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

const VALID_PREVIEW = {
  code: "WELCOME10",
  valid: true,
  discountType: "PERCENTAGE" as const,
  discountValue: 10,
  subtotal: 100_000,
  discountAmount: 10_000,
  total: 90_000,
  reasonCode: null,
  message: "Mã giảm giá hợp lệ",
};

const INVALID_PREVIEW = {
  code: "EXPIRED",
  valid: false,
  discountType: null,
  discountValue: null,
  subtotal: 100_000,
  discountAmount: 0,
  total: 100_000,
  reasonCode: "COUPON_EXPIRED" as const,
  message: "Mã giảm giá đã hết hạn",
};

describe("CouponInput", () => {
  it("has a labeled input and an accessible submit button", () => {
    renderWithProviders(<CouponInput />);
    expect(screen.getByLabelText("Mã giảm giá")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeInTheDocument();
  });

  it("previews then applies when the code is valid — Enter submits the form", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.previewCoupon).mockResolvedValue(VALID_PREVIEW);
    vi.mocked(cartApi.applyCoupon).mockResolvedValue({} as never);
    renderWithProviders(<CouponInput />);

    await user.type(screen.getByLabelText("Mã giảm giá"), "welcome10{Enter}");

    await waitFor(() => expect(cartApi.previewCoupon).toHaveBeenCalledWith("WELCOME10"));
    await waitFor(() => expect(cartApi.applyCoupon).toHaveBeenCalledWith("WELCOME10"));
  });

  it("trims and uppercases the code before submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.previewCoupon).mockResolvedValue(VALID_PREVIEW);
    vi.mocked(cartApi.applyCoupon).mockResolvedValue({} as never);
    renderWithProviders(<CouponInput />);

    await user.type(screen.getByLabelText("Mã giảm giá"), "  welcome10  ");
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() => expect(cartApi.previewCoupon).toHaveBeenCalledWith("WELCOME10"));
  });

  it("shows the server message and never calls apply when preview is invalid", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.previewCoupon).mockResolvedValue(INVALID_PREVIEW);
    renderWithProviders(<CouponInput />);

    await user.type(screen.getByLabelText("Mã giảm giá"), "EXPIRED{Enter}");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Mã giảm giá đã hết hạn"));
    expect(cartApi.applyCoupon).not.toHaveBeenCalled();
    // Code the user typed is preserved, not cleared, on error.
    expect(screen.getByLabelText("Mã giảm giá")).toHaveValue("EXPIRED");
  });

  it("shows a friendly message (not a raw error) on a server failure, and keeps the typed code", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.previewCoupon).mockRejectedValue(new Error("500"));
    renderWithProviders(<CouponInput />);

    await user.type(screen.getByLabelText("Mã giảm giá"), "SOMECODE{Enter}");

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).not.toContain("AxiosError");
    expect(screen.getByLabelText("Mã giảm giá")).toHaveValue("SOMECODE");
  });

  it("disables the submit button while empty", () => {
    renderWithProviders(<CouponInput />);
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });

  it("does not allow apply when the cart is empty (disabled prop)", () => {
    renderWithProviders(<CouponInput disabled />);
    expect(screen.getByLabelText("Mã giảm giá")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });

  it("prevents a double submit while pending", async () => {
    const user = userEvent.setup();
    let resolvePreview: (value: typeof VALID_PREVIEW) => void = () => {};
    vi.mocked(cartApi.previewCoupon).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    renderWithProviders(<CouponInput />);

    await user.type(screen.getByLabelText("Mã giảm giá"), "WELCOME10");
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));
    await user.click(screen.getByRole("button", { name: /đang áp dụng/i }));

    expect(cartApi.previewCoupon).toHaveBeenCalledTimes(1);
    resolvePreview(VALID_PREVIEW);
  });
});
