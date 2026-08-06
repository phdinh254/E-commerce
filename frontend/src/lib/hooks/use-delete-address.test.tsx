import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import { useDeleteAddress } from "./use-delete-address";

vi.mock("@/lib/api/addresses", () => ({
  addressesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useDeleteAddress", () => {
  it("deletes and invalidates the address list on success (a promoted default is only visible via refetch)", async () => {
    vi.mocked(addressesApi.remove).mockResolvedValue(undefined);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteAddress(), { wrapper });

    await act(async () => {
      result.current.mutate("address-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addressesApi.remove).toHaveBeenCalledWith("address-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.addresses.all });
  });

  it("does not swallow errors", async () => {
    vi.mocked(addressesApi.remove).mockRejectedValue(new Error("ADDRESS_NOT_FOUND"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteAddress(), { wrapper });

    await act(async () => {
      result.current.mutate("address-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
