import { apiClient } from "@/lib/api/client";
import type { User } from "@/types/commerce";

export const profileApi = {
  /** GET /auth/me — reused as-is (see backend ProfileController comment):
   * a dedicated `GET /profile` would duplicate this exact endpoint. */
  async getProfile(signal?: AbortSignal): Promise<User> {
    const response = await apiClient.get<User>("/auth/me", { signal });
    return response.data;
  },

  /** PATCH /profile — payload is `fullName` only, never role/email/status. */
  async updateProfile(fullName: string): Promise<User> {
    const response = await apiClient.patch<User>("/profile", { fullName });
    return response.data;
  },
};
