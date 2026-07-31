import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { FilterSheet, FilterSidebar } from "@/components/commerce/product-filters";
import { ProductGrid } from "@/components/commerce/product-grid";
import { AppPagination } from "@/components/commerce/app-pagination";
import { SortSelect } from "@/components/commerce/sort-select";
import { StatePanel } from "@/components/feedback/state-panel";

export const metadata: Metadata = { title: "S?n ph?m", description: "Kh?m ph? thi?t b? c?ng ngh? v? phong c?ch s?ng ???c ch?n l?c." };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string; page?: string }> }) {
  const params = await searchParams;
  const [categories, rawProducts] = await Promise.all([commerceRepository.getCategories(), commerceRepository.getProducts({ category: params.category })]);
  const products = [...rawProducts].sort((a, b) => params.sort === "price-asc" ? a.price - b.price : params.sort === "price-desc" ? b.price - a.price : params.sort === "rating" ? b.rating - a.rating : params.sort === "newest" ? Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const currentCategory = categories.find((category) => category.slug === params.category);
  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: currentCategory?.name ?? "S?n ph?m" }]} />
      <div className="mt-6 border-b pb-7"><h1 className="text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{currentCategory?.name ?? "T?t c? s?n ph?m"}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{currentCategory?.description ?? "Thi?t b? v? ?? d?ng ???c ch?n theo ch?t l??ng ho?n thi?n, c?ng n?ng v? tr?i nghi?m l?u d?i."}</p></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{products.length}</span> k?t qu?</p><div className="flex items-center gap-2"><FilterSheet categories={categories} currentCategory={params.category} /><SortSelect value={params.sort} /></div></div>
      <div className="mt-8 flex gap-8"><FilterSidebar categories={categories} currentCategory={params.category} /><div className="min-w-0 flex-1">{products.length ? <><ProductGrid products={products} /><AppPagination current={Number(params.page ?? 1)} /></> : <StatePanel kind="empty" title="Ch?a c? s?n ph?m ph? h?p" description="H?y b? b?t b? l?c ho?c kh?m ph? danh m?c kh?c." actionLabel="Xem t?t c? s?n ph?m" actionHref="/products" />}</div></div>
    </Container>
  );
}
