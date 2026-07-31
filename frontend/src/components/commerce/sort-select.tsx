"use client";

import { useRouter } from "next/navigation";

export function SortSelect({ value = "featured" }: { value?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Sắp xếp</span><select aria-label="Sắp xếp sản phẩm" value={value} onChange={(event) => router.push(`/products?sort=${event.target.value}`)} className="h-11 rounded-xl border bg-card px-3 text-sm font-medium"><option value="featured">Nổi bật</option><option value="newest">Mới nhất</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option><option value="rating">Đánh giá cao</option></select></label>
  );
}
