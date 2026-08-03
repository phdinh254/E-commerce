import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GoogleCallbackPanel } from "./google-callback-panel";
import { useAuth } from "@/lib/auth/auth-provider";

const replaceMock = vi.fn();

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GoogleCallbackPanel", () => {
  it("shows a waiting state while the session is still being restored", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "loading",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    render(<GoogleCallbackPanel />);
    expect(screen.getByText("Đang hoàn tất đăng nhập...")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to /account once the session restores as authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", email: "a@example.com", fullName: "A", role: "CUSTOMER", status: "ACTIVE" },
      status: "authenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    render(<GoogleCallbackPanel />);
    expect(replaceMock).toHaveBeenCalledWith("/account");
  });

  it("shows an error state with a link back to login when restoration fails", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "unauthenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    render(<GoogleCallbackPanel />);
    expect(screen.getByText("Không thể đăng nhập bằng Google")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" })).toHaveAttribute("href", "/login");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
