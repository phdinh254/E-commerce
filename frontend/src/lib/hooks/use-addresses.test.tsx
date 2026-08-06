import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { addressesApi } from "@/lib/api/addresses";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAddresses } from "./use-addresses";
import type { Address } from "@/types/address";

vi.mock("@/lib/api/addresses", () => ({
  addressesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
}));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const ADDRESS: Address = {
  id: "address-1",
  label: null,
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

function mockAuth(status: "loading" | "authenticated" | "unauthenticated") {
  vi.mocked(useAuth).mockReturnValue({ user: null, status, setUser: vi.fn(), logout: vi.fn() });
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return wrapper;
}

describe("useAddresses", () => {
  it("does not fetch for a guest", () => {
    mockAuth("unauthenticated");
    const wrapper = makeWrapper();
    renderHook(() => useAddresses(), { wrapper });

    expect(addressesApi.list).not.toHaveBeenCalled();
  });

  it("fetches once authenticated", async () => {
    mockAuth("authenticated");
    vi.mocked(addressesApi.list).mockResolvedValue([ADDRESS]);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddresses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([ADDRESS]);
  });
});
