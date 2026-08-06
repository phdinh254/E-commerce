import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { addressesApi } from "@/lib/api/addresses";
import { queryKeys } from "@/lib/api/query-keys";
import { useCreateAddress } from "./use-create-address";
import type { Address, AddressPayload } from "@/types/address";

vi.mock("@/lib/api/addresses", () => ({
  addressesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const PAYLOAD: AddressPayload = {
  recipientName: "Nguyen Van A",
  phoneNumber: "0912345678",
  province: "Ha Noi",
  district: "Cau Giay",
  ward: "Dich Vong",
  streetAddress: "123 Xuan Thuy",
};

const CREATED: Address = {
  id: "address-1",
  label: null,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...PAYLOAD,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useCreateAddress", () => {
  it("creates and invalidates the address list on success", async () => {
    vi.mocked(addressesApi.create).mockResolvedValue(CREATED);
    const { wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateAddress(), { wrapper });

    await act(async () => {
      result.current.mutate(PAYLOAD);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addressesApi.create).toHaveBeenCalledWith(PAYLOAD);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.addresses.all });
  });
});
