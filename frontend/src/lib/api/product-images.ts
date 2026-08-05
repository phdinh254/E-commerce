import { apiClient } from "@/lib/api/client";
import type { ProductImage } from "@/types/product-detail";

export const productImagesApi = {
  /**
   * GET /products/:productId/images — public (ProductImagesService.listPublic).
   * Returns freshly-signed URLs; the response must never be cached longer
   * than the query's own staleTime, and never persisted client-side.
   */
  async list(productId: string, signal?: AbortSignal): Promise<ProductImage[]> {
    const response = await apiClient.get<ProductImage[]>(
      `/products/${encodeURIComponent(productId)}/images`,
      { signal },
    );
    return response.data;
  },
};
