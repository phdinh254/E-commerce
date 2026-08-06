import { apiClient } from "@/lib/api/client";
import type { FeaturedCoupon } from "@/types/coupon";

export const couponsApi = {
  /** GET /coupons/featured — public. */
  async getFeatured(limit?: number, signal?: AbortSignal): Promise<FeaturedCoupon[]> {
    const response = await apiClient.get<FeaturedCoupon[]>("/coupons/featured", {
      params: typeof limit === "number" ? { limit } : undefined,
      signal,
    });
    return response.data;
  },
};
