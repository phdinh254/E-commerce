import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiError } from "@/types/commerce";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let accessToken: string | null = null;

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
  withCredentials: true,
  timeout: 12_000,
  headers: { "Content-Type": "application/json", "Accept-Language": "vi" },
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetryableConfig | undefined;
    const isRefresh = config?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && config && !config._retry && !isRefresh) {
      config._retry = true;
      try {
        const response = await apiClient.post<{ accessToken: string }>("/auth/refresh");
        setAccessToken(response.data.accessToken);
        config.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return apiClient(config);
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error)) {
    if (!error.response) return "Kh?ng th? k?t n?i m?y ch?. Vui l?ng ki?m tra k?t n?i v? th? l?i.";
    return error.response.data?.message ?? "Y?u c?u ch?a th? ho?n t?t.";
  }
  return "?? x?y ra l?i. Vui l?ng th? l?i.";
}
