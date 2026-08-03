import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthForm } from "./auth-form";
import { authApi } from "@/lib/api/auth";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { apiClient } from "@/lib/api/client";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

function renderWithProviders(ui: React.ReactElement) {
  // AuthProvider's mount-time silent refresh has no session to restore in
  // these tests; reject it so it settles as unauthenticated instead of
  // hanging pending.
  vi.mocked(apiClient.post).mockRejectedValue(new Error("no session"));
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("AuthForm — forgot mode", () => {
  it("calls authApi.forgotPassword with the entered email and shows the neutral success message", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      message: "Nếu email đã được đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi.",
    });
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="forgot" />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /gửi hướng dẫn/i }));

    await waitFor(() =>
      expect(authApi.forgotPassword).toHaveBeenCalledWith("user@example.com"),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Nếu email đã được đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi.",
      ),
    );
    expect(push).toHaveBeenCalledWith("/login");
  });
});

describe("AuthForm — reset mode", () => {
  it("calls authApi.resetPassword with the token from the URL and the new password", async () => {
    searchParams = new URLSearchParams("token=raw-token-123");
    vi.mocked(authApi.resetPassword).mockResolvedValue({
      message: "Mật khẩu đã được cập nhật.",
    });
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="reset" />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "NewStrongPass123!");
    await user.type(
      screen.getByLabelText("Xác nhận mật khẩu"),
      "NewStrongPass123!",
    );
    await user.click(
      screen.getByRole("button", { name: /cập nhật mật khẩu/i }),
    );

    await waitFor(() =>
      expect(authApi.resetPassword).toHaveBeenCalledWith(
        "raw-token-123",
        "NewStrongPass123!",
      ),
    );
  });

  it("does not call the API and shows an error when the URL has no token", async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="reset" />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "NewStrongPass123!");
    await user.type(
      screen.getByLabelText("Xác nhận mật khẩu"),
      "NewStrongPass123!",
    );
    await user.click(
      screen.getByRole("button", { name: /cập nhật mật khẩu/i }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });
});
