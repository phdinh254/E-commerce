"use client";

import { useRelatedProducts } from "@/lib/hooks/use-related-products";
import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import { CatalogProductGridSkeleton } from "@/components/catalog/catalog-states";
import { StatePanel } from "@/components/feedback/state-panel";

/**
 * Ch14-B134. One real, server-filtered request (GET /products?categoryId=…),
 * not a client-side filter over the whole catalog and not Math.random()
 * sampling. Reuses CatalogProductCard (Ch13) rather than a new card.
 */
export function RelatedProducts({ categoryId, excludeProductId }: { categoryId: string | undefined; excludeProductId: string | undefined }) {
  const { items, isLoading, isError, refetch } = useRelatedProducts(categoryId, excludeProductId);

  if (!categoryId) return null;
  if (isLoading) return <CatalogProductGridSkeleton count={4} />;
  if (isError) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải sản phẩm liên quan"
        description="Đã có lỗi xảy ra khi tải danh sách. Vui lòng thử lại."
        actionLabel="Thử lại"
        onRetry={() => void refetch()}
      />
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4 xl:gap-x-6">
      {items.map((product) => (
        <CatalogProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
