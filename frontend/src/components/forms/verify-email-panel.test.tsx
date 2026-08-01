import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VerifyEmailPanel } from "./verify-email-panel";
import { authApi } from "@/lib/api/auth";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}));

function renderWithProviders() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <VerifyEmailPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("VerifyEmailPanel — missing token", () => {
  it("shows the missing-link message and never calls verifyEmail", async () => {
    renderWithProviders();

    expect(
      screen.getByText("Thiếu đường dẫn xác minh"),
    ).toBeInTheDocument();
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Gửi lại email xác minh")).toBeInTheDocument();
  });
});

describe("VerifyEmailPanel — token present", () => {
  it("verifies the token exactly once and shows the success message", async () => {
    searchParams = new URLSearchParams("token=raw-token-123");
    vi.mocked(authApi.verifyEmail).mockResolvedValue({ verified: true });

    renderWithProviders();

    await waitFor(() =>
      expect(
        screen.getByText("Tài khoản của bạn đã được xác minh thành công."),
      ).toBeInTheDocument(),
    );
    expect(authApi.verifyEmail).toHaveBeenCalledTimes(1);
    expect(authApi.verifyEmail).toHaveBeenCalledWith("raw-token-123");
  });

  it("shows an error and the resend form when the token is invalid", async () => {
    searchParams = new URLSearchParams("token=bad-token");
    vi.mocked(authApi.verifyEmail).mockRejectedValue(new Error("invalid"));

    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByLabelText("Gửi lại email xác minh")).toBeInTheDocument(),
    );
  });

  it("lets the user resend the verification email after a failed verification", async () => {
    searchParams = new URLSearchParams("token=bad-token");
    vi.mocked(authApi.verifyEmail).mockRejectedValue(new Error("invalid"));
    vi.mocked(authApi.resendVerification).mockResolvedValue({
      message: "Nếu email tồn tại và chưa xác minh, hướng dẫn sẽ được gửi.",
    });
    const user = userEvent.setup();

    renderWithProviders();

    const emailInput = await screen.findByLabelText("Gửi lại email xác minh");
    await user.type(emailInput, "user@example.com");
    await user.click(screen.getByRole("button", { name: /gửi lại/i }));

    await waitFor(() =>
      expect(authApi.resendVerification).toHaveBeenCalledWith(
        "user@example.com",
      ),
    );
  });
});
