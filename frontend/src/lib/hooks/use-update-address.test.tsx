import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import { useUpdateAddress } from "./use-update-address";
import type { Address } from "@/types/address";

vi.mock("@/lib/api/addresses", () => ({
  addressesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const UPDATED: Address = {
  id: "address-1",
  label: null,
  recipientName: "Updated Name",
  phoneNumber: "0912345678",
  province: "Ha Noi",
  district: "Cau Giay",
  ward: "Dich Vong",
  streetAddress: "123 Xuan Thuy",
  isDefault: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useUpdateAddress", () => {
  it("updates and invalidates the address list on success", async () => {
    vi.mocked(addressesApi.update).mockResolvedValue(UPDATED);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateAddress(), { wrapper });

    await act(async () => {
      result.current.mutate({ addressId: "address-1", payload: { recipientName: "Updated Name" } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addressesApi.update).toHaveBeenCalledWith("address-1", { recipientName: "Updated Name" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.addresses.all });
  });
});
