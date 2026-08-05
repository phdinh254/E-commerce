"use client";

import { useCategories } from "@/lib/hooks/use-categories";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";
import { CategoryFilterList } from "@/components/catalog/category-filter-list";
import { PriceRangeFilter } from "@/components/catalog/price-range-filter";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Desktop-only (`hidden lg:block`, matching the pre-existing FilterSidebar
 * layout). Category selection applies immediately (a click is not
 * something that needs a confirm step); price range still requires the
 * explicit "Áp dụng khoảng giá" button inside PriceRangeFilter — see that
 * component for why. Shares CategoryFilterList/PriceRangeFilter with the
 * mobile drawer (CatalogFilterDrawer) rather than reimplementing them.
 */
export function CatalogFilterSidebar() {
  const { filters, setCategory, setPriceRange } = useCatalogFilters();
  const categoriesQuery = useCategories();

  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Bộ lọc sản phẩm">
      <div className="space-y-7">
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
                value={filters.categorySlug}
                onSelect={setCategory}
              />
            )}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Khoảng giá</h2>
          <div className="mt-3">
            <PriceRangeFilter
              idPrefix="sidebar"
              value={{ min: filters.minPrice, max: filters.maxPrice }}
              onApply={(min, max) => setPriceRange(min, max)}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
