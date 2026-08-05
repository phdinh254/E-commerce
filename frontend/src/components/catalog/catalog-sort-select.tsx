"use client";

import { isCatalogSortOption, type CatalogSortOption } from "@/lib/catalog/search-params";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";

const SORT_LABELS: Record<"" | CatalogSortOption, string> = {
  "": "Mặc định",
  "price-asc": "Giá tăng dần",
  "price-desc": "Giá giảm dần",
  "name-asc": "Tên A đến Z",
  "name-desc": "Tên Z đến A",
};

/**
 * Native `<select>` — fully keyboard/screen-reader accessible without
 * extra ARIA wiring, matching the pre-existing `SortSelect` component's
 * approach (see components/commerce/sort-select.tsx). The empty value
 * ("") maps to `sort: null`, which omits `sortBy`/`sortOrder` from the
 * request entirely so the backend's own default applies — see
 * search-params.ts.
 */
export function CatalogSortSelect() {
  const { filters, setSort } = useCatalogFilters();
  const value = filters.sort ?? "";

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sắp xếp</span>
      <select
        aria-label="Sắp xếp sản phẩm"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setSort(next === "" ? null : isCatalogSortOption(next) ? next : null);
        }}
        className="h-11 rounded-xl border bg-card px-3 text-sm font-medium"
      >
        {(Object.keys(SORT_LABELS) as Array<"" | CatalogSortOption>).map((key) => (
          <option key={key || "default"} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
