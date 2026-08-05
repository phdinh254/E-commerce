"use client";

import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { CatalogSearchInput } from "@/components/catalog/catalog-search-input";
import { CatalogSortSelect } from "@/components/catalog/catalog-sort-select";
import { CatalogFilterSidebar } from "@/components/catalog/catalog-filter-sidebar";
import { CatalogFilterDrawer } from "@/components/catalog/catalog-filter-drawer";
import { CatalogActiveFilters } from "@/components/catalog/catalog-active-filters";
import { CatalogProductList } from "@/components/catalog/catalog-product-list";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";
import { useCategories } from "@/lib/hooks/use-categories";

/**
 * Client-rendered catalog: filters live in the URL (useCatalogFilters),
 * products/categories are fetched via TanStack Query — this composes
 * Ch13-B117 through Ch13-B126 into one page. `/products` is the single
 * canonical catalog route; `/search` redirects here with `q` set (see
 * app/(store)/search/page.tsx) rather than duplicating this tree.
 */
export function CatalogPage() {
  const { filters } = useCatalogFilters();
  const categoriesQuery = useCategories();
  const currentCategory = categoriesQuery.data?.find((c) => c.slug === filters.categorySlug);

  const title = currentCategory?.name ?? (filters.q ? `Kết quả cho "${filters.q}"` : "Tất cả sản phẩm");
  const description =
    currentCategory?.description ??
    "Thiết bị và đồ dùng được tuyển chọn dựa trên chất lượng hoàn thiện, công năng và trải nghiệm lâu dài.";

  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: currentCategory?.name ?? "Sản phẩm" }]} />

      <div className="mt-6 border-b pb-7">
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
        <CatalogSearchInput className="mt-5 max-w-xl" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <CatalogActiveFilters />
        <div className="ml-auto flex items-center gap-2">
          <CatalogFilterDrawer />
          <CatalogSortSelect />
        </div>
      </div>

      <div className="mt-8 flex gap-8">
        <CatalogFilterSidebar />
        <div className="min-w-0 flex-1">
          <CatalogProductList />
        </div>
      </div>
    </Container>
  );
}
