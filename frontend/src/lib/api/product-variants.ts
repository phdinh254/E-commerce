import { apiClient } from "@/lib/api/client";
import type { ProductVariant } from "@/types/product-detail";

export const productVariantsApi = {
  /** GET /products/:productId/variants — public, active-only (ProductVariantsService.listPublicVariants). */
  async list(productId: string, signal?: AbortSignal): Promise<ProductVariant[]> {
    const response = await apiClient.get<ProductVariant[]>(
      `/products/${encodeURIComponent(productId)}/variants`,
      { signal },
    );
    return response.data;
  },
};
