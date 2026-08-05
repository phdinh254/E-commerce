"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";
import { Container } from "@/components/layout/container";

export function ProductDetailSkeleton() {
  return (
    <Container className="py-8 sm:py-10 lg:py-12" role="status" aria-label="Đang tải sản phẩm">
      <Skeleton className="h-5 w-48" />
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </Container>
  );
}

export function ProductDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <Container className="py-16">
      <StatePanel
        kind="error"
        title="Không thể tải sản phẩm"
        description="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
        actionLabel="Thử lại"
        onRetry={onRetry}
      />
    </Container>
  );
}
