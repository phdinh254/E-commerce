import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { checkoutApi } from "@/lib/api/checkout";
import { queryKeys } from "@/lib/api/query-keys";
import { usePlaceCodOrder } from "./use-place-cod-order";
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
  paymentMethod: "COD",
  paymentStatus: "PAID",
  checkoutUrl: null,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("usePlaceCodOrder", () => {
  it("sends a fresh Idempotency-Key and never leaks price/total/userId in the payload", async () => {
    vi.mocked(checkoutApi.placeCod).mockResolvedValue(RESULT);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePlaceCodOrder(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [payload, key] = vi.mocked(checkoutApi.placeCod).mock.calls[0] as unknown as [
      Record<string, unknown>,
      string,
    ];
    expect(payload).toEqual(PAYLOAD);
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("paymentStatus");
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("invalidates the cart cache on success (the backend just consumed it)", async () => {
    vi.mocked(checkoutApi.placeCod).mockResolvedValue(RESULT);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePlaceCodOrder(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.cart.detail });
  });

  it("does not swallow errors", async () => {
    vi.mocked(checkoutApi.placeCod).mockRejectedValue(new Error("CART_EMPTY"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePlaceCodOrder(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
