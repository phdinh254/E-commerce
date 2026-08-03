import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserMenu } from "./user-menu";
import { useAuth } from "@/lib/auth/auth-provider";

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockUser = {
  id: "u1",
  email: "minhanh@example.com",
  fullName: "Nguyễn Minh Anh",
  role: "CUSTOMER" as const,
  status: "ACTIVE" as const,
};

describe("UserMenu", () => {
  it("shows a loading skeleton while the session is being restored", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "loading",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    const { container } = render(<UserMenu />);
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
    expect(screen.queryByText("Đăng nhập")).not.toBeInTheDocument();
  });

  it("shows Đăng nhập / Đăng ký links when unauthenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "unauthenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Đăng ký" })).toHaveAttribute("href", "/register");
  });

  it("shows the user's initials and name when authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      status: "authenticated",
      setUser: vi.fn(),
      logout: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: `Tài khoản của ${mockUser.fullName}` })).toBeInTheDocument();
    expect(screen.queryByText("Đăng nhập")).not.toBeInTheDocument();
  });
});
