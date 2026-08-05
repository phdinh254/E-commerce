"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/components/commerce/price-display";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";
import { catalogFiltersHaveActiveFilter } from "@/lib/catalog/search-params";

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Reflects exactly the filters that will actually reach the API — a
 * category slug in the URL that doesn't resolve to a real category (see
 * catalogFiltersToApiQuery's "unknown slug" branch) never renders a chip
 * here, since it isn't a real active filter. Sort is intentionally never
 * shown here or cleared by "Xóa tất cả": it's a separate control (see
 * catalog-sort-select.tsx and use-catalog-filters.ts's clearAllFilters).
 */
export function CatalogActiveFilters() {
  const { filters, clearFilter, clearAllFilters } = useCatalogFilters();
  const categoriesQuery = useCategories();

  const chips: Chip[] = [];

  if (filters.q) {
    chips.push({ key: "q", label: `Từ khóa: ${filters.q}`, onRemove: () => clearFilter("q") });
  }

  if (filters.categorySlug) {
    const category = categoriesQuery.data?.find((c) => c.slug === filters.categorySlug);
    if (category) {
      chips.push({
        key: "category",
        label: `Danh mục: ${category.name}`,
        onRemove: () => clearFilter("categorySlug"),
      });
    }
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const label =
      filters.minPrice !== null && filters.maxPrice !== null
        ? `Giá từ ${formatVnd(filters.minPrice)} đến ${formatVnd(filters.maxPrice)}`
        : filters.minPrice !== null
          ? `Giá từ ${formatVnd(filters.minPrice)}`
          : `Giá đến ${formatVnd(filters.maxPrice as number)}`;
    chips.push({ key: "price", label, onRemove: () => clearFilter("minPrice") });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="region"
      aria-label="Bộ lọc đang áp dụng"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex items-center gap-1.5 rounded-full border bg-card py-1 pl-3 pr-1.5 text-sm"
        >
          {chip.label}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Xóa bộ lọc: ${chip.label}`}
            onClick={chip.onRemove}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </span>
      ))}
      {catalogFiltersHaveActiveFilter(filters) ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>
          Xóa tất cả
        </Button>
      ) : null}
    </div>
  );
}
