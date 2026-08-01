import { apiClient, setAccessToken } from "@/lib/api/client";
import type { User } from "@/types/commerce";

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload extends LoginPayload { fullName: string; }
interface AuthResponse { accessToken: string; user: User; }

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/login", payload);
    setAccessToken(response.data.accessToken);
    return response.data;
  },
  async register(payload: RegisterPayload): Promise<User> {
    const response = await apiClient.post<User>("/auth/register", payload);
    return response.data;
  },
  async me(): Promise<User> {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },
  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
    setAccessToken(null);
  },
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/auth/forgot-password",
      { email },
    );
    return response.data;
  },
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/auth/reset-password",
      { token, newPassword },
    );
    return response.data;
  },
  async verifyEmail(token: string): Promise<{ verified: true }> {
    const response = await apiClient.post<{ verified: true }>(
      "/auth/verify-email",
      { token },
    );
    return response.data;
  },
  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/auth/resend-verification",
      { email },
    );
    return response.data;
  },
};
