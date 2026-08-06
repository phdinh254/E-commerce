import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { checkoutApi } from "@/lib/api/checkout";
import { usePlacePayOsOrder } from "./use-place-payos-order";
import type { CheckoutPayload, CheckoutResult } from "@/types/payment";

vi.mock("@/lib/api/checkout", () => ({ checkoutApi: { placeCod: vi.fn(), placePayOs: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const PAYLOAD: CheckoutPayload = {
  addressId: "address-1",
};

const RESULT: CheckoutResult = {
  orderId: "order-1",
  paymentId: "payment-1",
  paymentMethod: "PAYOS",
  paymentStatus: "PENDING",
  checkoutUrl: "https://pay.payos.vn/web/abc",
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return wrapper;
}

describe("usePlacePayOsOrder", () => {
  it("returns the checkoutUrl from the backend response, unmodified", async () => {
    vi.mocked(checkoutApi.placePayOs).mockResolvedValue(RESULT);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => usePlacePayOsOrder(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.checkoutUrl).toBe("https://pay.payos.vn/web/abc");
  });

  it("uses a different Idempotency-Key on a second, separate mutate() call", async () => {
    vi.mocked(checkoutApi.placePayOs).mockResolvedValue(RESULT);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => usePlacePayOsOrder(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });
    await waitFor(() => expect(checkoutApi.placePayOs).toHaveBeenCalledTimes(2));

    const [, keyA] = vi.mocked(checkoutApi.placePayOs).mock.calls[0] as [unknown, string];
    const [, keyB] = vi.mocked(checkoutApi.placePayOs).mock.calls[1] as [unknown, string];
    expect(keyA).not.toBe(keyB);
  });
});
