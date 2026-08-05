import { apiClient } from "@/lib/api/client";
import type { ProductOption } from "@/types/product-detail";

export const productOptionsApi = {
  /** GET /products/:productId/options — public (ProductOptionsService.listOptionsForProduct). */
  async list(productId: string, signal?: AbortSignal): Promise<ProductOption[]> {
    const response = await apiClient.get<ProductOption[]>(
      `/products/${encodeURIComponent(productId)}/options`,
      { signal },
    );
    return response.data;
  },
};
