"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";
import { CategoryFilterList } from "@/components/catalog/category-filter-list";
import { PriceRangeFilter } from "@/components/catalog/price-range-filter";

interface Draft {
  categorySlug: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

/**
 * Mobile-only (`lg:hidden`) filter drawer. Uses a local draft, per the
 * task's explicit contract for this pattern: initialized from the URL
 * every time the sheet opens, applied to the URL in one navigation when
 * "Áp dụng" is pressed, and completely discarded (never touches the URL)
 * on cancel/outside-click/Esc. Reopening always reflects whatever the URL
 * currently says, never a leftover draft from a previous cancel.
 *
 * Shares CategoryFilterList/PriceRangeFilter with the desktop sidebar
 * (CatalogFilterSidebar) — same validation, same rendering, only the
 * apply strategy differs (immediate there, batched here).
 */
export function CatalogFilterDrawer() {
  const { filters, setFilters } = useCatalogFilters();
  const categoriesQuery = useCategories();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    categorySlug: filters.categorySlug,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft({
        categorySlug: filters.categorySlug,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      });
    }
    setOpen(next);
  }

  function apply() {
    setFilters({
      categorySlug: draft.categorySlug,
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
    });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "lg" }), "lg:hidden")}>
        <SlidersHorizontal aria-hidden="true" />
        Bộ lọc
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(88vw,380px)] flex-col">
        <SheetHeader>
          <SheetTitle>Bộ lọc sản phẩm</SheetTitle>
          <SheetDescription>Thu hẹp kết quả theo nhu cầu của bạn.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-7 overflow-y-auto px-4 pb-4">
          <div>
            <h2 className="text-sm font-semibold">Danh mục</h2>
            <div className="mt-3">
              {categoriesQuery.isPending ? (
                <div className="grid gap-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : categoriesQuery.isError ? (
                <p className="text-sm text-muted-foreground">Không thể tải danh mục.</p>
              ) : (
                <CategoryFilterList
                  categories={categoriesQuery.data ?? []}
                  value={draft.categorySlug}
                  onSelect={(categorySlug) => setDraft((prev) => ({ ...prev, categorySlug }))}
                />
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Khoảng giá</h2>
            <div className="mt-3">
              <PriceRangeFilter
                idPrefix="drawer"
                value={{ min: draft.minPrice, max: draft.maxPrice }}
                onApply={(minPrice, maxPrice) => setDraft((prev) => ({ ...prev, minPrice, maxPrice }))}
              />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row gap-2 border-t pt-4">
          <SheetClose className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>Hủy</SheetClose>
          <Button type="button" className="flex-1" onClick={apply}>
            Áp dụng bộ lọc
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
