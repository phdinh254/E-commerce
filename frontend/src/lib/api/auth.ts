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
};
