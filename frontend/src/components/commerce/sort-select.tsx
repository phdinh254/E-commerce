"use client";

import { useRouter } from "next/navigation";

export function SortSelect({ value = "featured" }: { value?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">S?p x?p</span><select aria-label="S?p x?p s?n ph?m" value={value} onChange={(event) => router.push(`/products?sort=${event.target.value}`)} className="h-11 rounded-xl border bg-card px-3 text-sm font-medium"><option value="featured">N?i b?t</option><option value="newest">M?i nh?t</option><option value="price-asc">Gi? th?p ??n cao</option><option value="price-desc">Gi? cao ??n th?p</option><option value="rating">??nh gi? cao</option></select></label>
  );
}
