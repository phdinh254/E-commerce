import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { profileApi } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/auth-provider";
import { queryKeys } from "@/lib/api/query-keys";
import { useUpdateProfile } from "./use-update-profile";
import type { User } from "@/types/commerce";

vi.mock("@/lib/api/profile", () => ({ profileApi: { getProfile: vi.fn(), updateProfile: vi.fn() } }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const UPDATED: User = { id: "u1", email: "user@example.com", fullName: "New Name", role: "CUSTOMER", status: "ACTIVE" };

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, client };
}

describe("useUpdateProfile", () => {
  it("sends only fullName and updates both the query cache and AuthProvider's user", async () => {
    vi.mocked(profileApi.updateProfile).mockResolvedValue(UPDATED);
    const setUser = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: null, status: "authenticated", setUser, logout: vi.fn() });
    const { wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      result.current.mutate("New Name");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profileApi.updateProfile).toHaveBeenCalledWith("New Name");
    expect(setUser).toHaveBeenCalledWith(UPDATED);
    expect(client.getQueryData(queryKeys.auth.me)).toEqual(UPDATED);
  });
});
