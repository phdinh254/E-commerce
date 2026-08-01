import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { authApi } from "./auth";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authApi", () => {
  it("forgotPassword posts the email to /auth/forgot-password and returns the message", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { message: "Nếu email đã được đăng ký, hướng dẫn sẽ được gửi." },
    });

    const result = await authApi.forgotPassword("user@example.com");

    expect(post).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "user@example.com",
    });
    expect(result.message).toBe(
      "Nếu email đã được đăng ký, hướng dẫn sẽ được gửi.",
    );
  });

  it("resetPassword posts the token and new password to /auth/reset-password", async () => {
    const post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { message: "Mật khẩu đã được cập nhật." } });

    const result = await authApi.resetPassword("raw-token", "NewPass123!");

    expect(post).toHaveBeenCalledWith("/auth/reset-password", {
      token: "raw-token",
      newPassword: "NewPass123!",
    });
    expect(result.message).toBe("Mật khẩu đã được cập nhật.");
  });

  it("verifyEmail posts the token to /auth/verify-email", async () => {
    const post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { verified: true } });

    const result = await authApi.verifyEmail("raw-token");

    expect(post).toHaveBeenCalledWith("/auth/verify-email", {
      token: "raw-token",
    });
    expect(result.verified).toBe(true);
  });

  it("resendVerification posts the email to /auth/resend-verification", async () => {
    const post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { message: "Đã gửi lại." } });

    const result = await authApi.resendVerification("user@example.com");

    expect(post).toHaveBeenCalledWith("/auth/resend-verification", {
      email: "user@example.com",
    });
    expect(result.message).toBe("Đã gửi lại.");
  });
});
