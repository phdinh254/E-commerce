import { apiClient } from "@/lib/api/client";
import type { ProductAttribute } from "@/types/product-detail";

export const productAttributesApi = {
  /** GET /products/:productId/attributes — public, isVisible-only (ProductAttributesService.listPublic). */
  async list(productId: string, signal?: AbortSignal): Promise<ProductAttribute[]> {
    const response = await apiClient.get<ProductAttribute[]>(
      `/products/${encodeURIComponent(productId)}/attributes`,
      { signal },
    );
    return response.data;
  },
};
