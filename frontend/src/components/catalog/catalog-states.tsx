"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";

/** Sized to roughly match a real CatalogProductCard so the initial-load->loaded transition doesn't jump. */
export function CatalogProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6"
      role="status"
      aria-label="Đang tải sản phẩm"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="mt-4 h-3 w-16" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-2 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Initial-load failure — the whole result area becomes this, filters stay intact (see CatalogPage). */
export function CatalogInitialError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <StatePanel
      kind="error"
      title="Không thể tải danh sách sản phẩm"
      description="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
      actionLabel={isRetrying ? "Đang thử lại..." : "Thử lại"}
      onRetry={onRetry}
    />
  );
}

export function CatalogEmptyState({ hasActiveFilter, onClearFilters }: { hasActiveFilter: boolean; onClearFilters: () => void }) {
  if (hasActiveFilter) {
    return (
      <StatePanel
        kind="notFound"
        title="Không tìm thấy sản phẩm phù hợp"
        description="Không có sản phẩm nào khớp với bộ lọc hiện tại. Hãy thử điều chỉnh từ khóa hoặc bộ lọc."
        actionLabel="Xóa bộ lọc"
        onRetry={onClearFilters}
      />
    );
  }
  return (
    <StatePanel
      kind="empty"
      title="Chưa có sản phẩm nào"
      description="Cửa hàng hiện chưa có sản phẩm nào để hiển thị. Vui lòng quay lại sau."
    />
  );
}

/** Renders below already-loaded products — never replaces the list that's already on screen. */
export function CatalogNextPageError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">Không thể tải thêm sản phẩm. Vui lòng thử lại.</p>
      <Button type="button" variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Đang thử lại..." : "Thử tải lại"}
      </Button>
    </div>
  );
}
