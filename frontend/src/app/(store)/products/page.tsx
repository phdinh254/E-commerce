import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { FilterSheet, FilterSidebar } from "@/components/commerce/product-filters";
import { ProductGrid } from "@/components/commerce/product-grid";
import { AppPagination } from "@/components/commerce/app-pagination";
import { SortSelect } from "@/components/commerce/sort-select";
import { StatePanel } from "@/components/feedback/state-panel";

export const metadata: Metadata = { title: "Sản phẩm", description: "Khám phá những thiết bị công nghệ và sản phẩm phong cách sống được tuyển chọn kỹ lưỡng." };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string; page?: string }> }) {
  const params = await searchParams;
  const [categories, rawProducts] = await Promise.all([commerceRepository.getCategories(), commerceRepository.getProducts({ category: params.category })]);
  const products = [...rawProducts].sort((a, b) => params.sort === "price-asc" ? a.price - b.price : params.sort === "price-desc" ? b.price - a.price : params.sort === "rating" ? b.rating - a.rating : params.sort === "newest" ? Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const currentCategory = categories.find((category) => category.slug === params.category);
  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: currentCategory?.name ?? "Sản phẩm" }]} />
      <div className="mt-6 border-b pb-7"><h1 className="text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{currentCategory?.name ?? "Tất cả sản phẩm"}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{currentCategory?.description ?? "Thiết bị và đồ dùng được tuyển chọn dựa trên chất lượng hoàn thiện, công năng và trải nghiệm lâu dài."}</p></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{products.length}</span> kết quả</p><div className="flex items-center gap-2"><FilterSheet categories={categories} currentCategory={params.category} /><SortSelect value={params.sort} /></div></div>
      <div className="mt-8 flex gap-8"><FilterSidebar categories={categories} currentCategory={params.category} /><div className="min-w-0 flex-1">{products.length ? <><ProductGrid products={products} /><AppPagination current={Number(params.page ?? 1)} /></> : <StatePanel kind="empty" title="Chưa có sản phẩm phù hợp" description="Hãy điều chỉnh bộ lọc hoặc khám phá một danh mục khác." actionLabel="Xem tất cả sản phẩm" actionHref="/products" />}</div></div>
    </Container>
  );
}
