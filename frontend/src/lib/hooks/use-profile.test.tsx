import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { profileApi } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/auth-provider";
import { useProfile } from "./use-profile";
import type { User } from "@/types/commerce";

vi.mock("@/lib/api/profile", () => ({ profileApi: { getProfile: vi.fn(), updateProfile: vi.fn() } }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const USER: User = { id: "u1", email: "user@example.com", fullName: "Nguyen Van A", role: "CUSTOMER", status: "ACTIVE" };

function mockAuth(status: "loading" | "authenticated" | "unauthenticated") {
  vi.mocked(useAuth).mockReturnValue({
    user: status === "authenticated" ? USER : null,
    status,
    setUser: vi.fn(),
    logout: vi.fn(),
  });
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return wrapper;
}

describe("useProfile", () => {
  it("does not fetch while auth status is loading or unauthenticated", () => {
    mockAuth("loading");
    const wrapper = makeWrapper();
    renderHook(() => useProfile(), { wrapper });

    expect(profileApi.getProfile).not.toHaveBeenCalled();
  });

  it("fetches once authenticated", async () => {
    mockAuth("authenticated");
    vi.mocked(profileApi.getProfile).mockResolvedValue(USER);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(USER);
  });
});
