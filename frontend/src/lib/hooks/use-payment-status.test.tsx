import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { paymentsApi } from "@/lib/api/payments";
import { usePaymentStatus } from "./use-payment-status";
import type { PaymentStatusResult } from "@/types/payment";

vi.mock("@/lib/api/payments", () => ({ paymentsApi: { getStatus: vi.fn(), syncStatus: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
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

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return wrapper;
}

describe("usePaymentStatus", () => {
  it("does not fetch when orderId is null", () => {
    const wrapper = makeWrapper();
    renderHook(() => usePaymentStatus(null), { wrapper });

    expect(paymentsApi.getStatus).not.toHaveBeenCalled();
  });

  it("fetches once orderId is provided", async () => {
    vi.mocked(paymentsApi.getStatus).mockResolvedValue(buildResult());
    const wrapper = makeWrapper();
    const { result } = renderHook(() => usePaymentStatus("order-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paymentsApi.getStatus).toHaveBeenCalledWith("order-1", expect.anything());
  });

  it("keeps polling while the status is non-terminal (PENDING)", async () => {
    vi.useFakeTimers();
    vi.mocked(paymentsApi.getStatus).mockResolvedValue(buildResult({ isTerminal: false }));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => usePaymentStatus("order-1"), { wrapper });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paymentsApi.getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(() => expect(paymentsApi.getStatus).toHaveBeenCalledTimes(2));
  });

  it("stops polling once the status becomes terminal (PAID)", async () => {
    vi.useFakeTimers();
    vi.mocked(paymentsApi.getStatus).mockResolvedValue(
      buildResult({ paymentStatus: "PAID", isTerminal: true, checkoutUrl: null }),
    );
    const wrapper = makeWrapper();
    const { result } = renderHook(() => usePaymentStatus("order-1"), { wrapper });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paymentsApi.getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    // Still exactly 1 — a terminal result must never trigger another poll.
    expect(paymentsApi.getStatus).toHaveBeenCalledTimes(1);
  });
});
