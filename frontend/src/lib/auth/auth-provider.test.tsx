import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth-provider";
import { apiClient, setAccessToken } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return {
    ...actual,
    apiClient: { post: vi.fn() },
    setAccessToken: vi.fn(),
  };
});

vi.mock("@/lib/api/auth", () => ({
  authApi: { logout: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const mockUser = {
  id: "u1",
  email: "user@example.com",
  fullName: "Nguyễn Văn A",
  role: "CUSTOMER" as const,
  status: "ACTIVE" as const,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("starts in loading state, then becomes authenticated on a successful silent refresh", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { accessToken: "token-1", user: mockUser },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.user).toEqual(mockUser);
    expect(setAccessToken).toHaveBeenCalledWith("token-1");
  });

  it("becomes unauthenticated when the silent refresh fails (no session cookie)", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("401"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.user).toBeNull();
  });

  it("setUser immediately marks the session authenticated (used right after login/register)", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    act(() => result.current.setUser(mockUser));

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(mockUser);
  });

  it("logout clears local state even when the server call fails, and reports serverRevoked: false", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { accessToken: "token-1", user: mockUser },
    });
    vi.mocked(authApi.logout).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    const outcome = await act(() => result.current.logout());

    expect(outcome).toEqual({ serverRevoked: false });
    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });

  it("logout reports serverRevoked: true on success", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { accessToken: "token-1", user: mockUser },
    });
    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    const outcome = await act(() => result.current.logout());
    expect(outcome).toEqual({ serverRevoked: true });
  });

  it("throws when useAuth is called outside an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });
});
