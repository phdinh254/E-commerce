import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { paymentsApi } from "@/lib/api/payments";
import { queryKeys } from "@/lib/api/query-keys";
import { useSyncPaymentStatus } from "./use-sync-payment-status";
import type { PaymentStatusResult } from "@/types/payment";

vi.mock("@/lib/api/payments", () => ({ paymentsApi: { getStatus: vi.fn(), syncStatus: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const RESULT: PaymentStatusResult = {
  orderId: "order-1",
  paymentId: "payment-1",
  paymentMethod: "PAYOS",
  paymentStatus: "PAID",
  orderStatus: "PAID",
  amount: 100_000,
  currency: "VND",
  paidAt: "2026-01-01T00:00:00.000Z",
  isTerminal: true,
  checkoutUrl: null,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useSyncPaymentStatus", () => {
  it("writes the fresh result straight into the payment-status query cache", async () => {
    vi.mocked(paymentsApi.syncStatus).mockResolvedValue(RESULT);
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useSyncPaymentStatus("order-1"), { wrapper });

    await act(async () => {
      result.current.mutate("payment-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paymentsApi.syncStatus).toHaveBeenCalledWith("payment-1");
    expect(client.getQueryData(queryKeys.payments.status("order-1"))).toEqual(RESULT);
  });

  it("does not write to the cache when orderId is null", async () => {
    vi.mocked(paymentsApi.syncStatus).mockResolvedValue(RESULT);
    const { wrapper, client } = makeWrapper();
    const setSpy = vi.spyOn(client, "setQueryData");
    const { result } = renderHook(() => useSyncPaymentStatus(null), { wrapper });

    await act(async () => {
      result.current.mutate("payment-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setSpy).not.toHaveBeenCalled();
  });
});
