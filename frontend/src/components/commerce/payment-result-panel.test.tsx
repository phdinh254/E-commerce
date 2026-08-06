import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePaymentStatus } from "@/lib/hooks/use-payment-status";
import { useSyncPaymentStatus } from "@/lib/hooks/use-sync-payment-status";
import { PaymentResultPanel } from "./payment-result-panel";
import type { PaymentStatusResult } from "@/types/payment";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
vi.mock("@/lib/hooks/use-payment-status", () => ({ usePaymentStatus: vi.fn() }));
vi.mock("@/lib/hooks/use-sync-payment-status", () => ({ useSyncPaymentStatus: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  vi.mocked(useSyncPaymentStatus).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
});

function buildResult(overrides: Partial<PaymentStatusResult> = {}): PaymentStatusResult {
  return {
    orderId: "order-1",
    paymentId: "payment-1",
    paymentMethod: "PAYOS",
    paymentStatus: "PENDING",
    orderStatus: "PENDING_PAYMENT",
    amount: 100_000,
    currency: "VND",
    paidAt: null,
    isTerminal: false,
    checkoutUrl: "https://pay.payos.vn/web/abc",
    ...overrides,
  };
}

describe("PaymentResultPanel", () => {
  it("shows an invalid-link message and never calls the status API when orderId is missing", () => {
    vi.mocked(usePaymentStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<PaymentResultPanel />);

    expect(screen.getByText("Không tìm thấy thông tin đơn hàng")).toBeInTheDocument();
  });

  it("renders success from the backend response, completely ignoring a conflicting ?status query param", () => {
    searchParams = new URLSearchParams("orderId=order-1&status=failed");
    vi.mocked(usePaymentStatus).mockReturnValue({
      data: buildResult({ paymentStatus: "PAID", isTerminal: true, checkoutUrl: null }),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<PaymentResultPanel />);

    // The URL claims "failed" — the rendered UI must reflect the backend's
    // PAID response instead, proving the query param is never trusted.
    expect(screen.getByText("Thanh toán đã được xác nhận")).toBeInTheDocument();
    expect(screen.queryByText("Thanh toán chưa thành công")).not.toBeInTheDocument();
  });

  it("shows a manual sync action while PENDING for a PayOS payment, and triggers the sync mutation on click", async () => {
    searchParams = new URLSearchParams("orderId=order-1");
    const mutate = vi.fn();
    vi.mocked(useSyncPaymentStatus).mockReturnValue({ mutate, isPending: false } as never);
    vi.mocked(usePaymentStatus).mockReturnValue({
      data: buildResult(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    const user = userEvent.setup();
    render(<PaymentResultPanel />);

    const button = screen.getByRole("button", { name: "Kiểm tra lại ngay" });
    await user.click(button);

    expect(mutate).toHaveBeenCalledWith("payment-1");
  });

  it("does not show a sync action for a PENDING COD payment (COD is never PENDING for long, but defensively)", () => {
    searchParams = new URLSearchParams("orderId=order-1");
    vi.mocked(usePaymentStatus).mockReturnValue({
      data: buildResult({ paymentMethod: "COD" }),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<PaymentResultPanel />);

    expect(screen.queryByRole("button", { name: "Kiểm tra lại ngay" })).not.toBeInTheDocument();
  });

  it("shows a retry action on error", async () => {
    searchParams = new URLSearchParams("orderId=order-1");
    const refetch = vi.fn();
    vi.mocked(usePaymentStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch,
    } as never);

    const user = userEvent.setup();
    render(<PaymentResultPanel />);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
