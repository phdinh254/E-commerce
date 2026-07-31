import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { ProductGrid } from "@/components/commerce/product-grid";
import { SearchBox } from "@/components/commerce/search-box";
import { StatePanel } from "@/components/feedback/state-panel";

export const metadata: Metadata = { title: "T?m ki?m" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const products = await commerceRepository.getProducts({ query: q });
  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: "T?m ki?m" }]} />
      <div className="mt-6 max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">K?t qu? t?m ki?m</h1><SearchBox defaultValue={q} className="mt-5" /></div>
      {q ? <p className="mt-8 border-b pb-5 text-sm text-muted-foreground">T?m th?y <span className="font-semibold text-foreground">{products.length}</span> k?t qu? cho ?{q}?</p> : null}
      <div className="mt-8">{q && products.length ? <ProductGrid products={products} /> : <StatePanel kind="notFound" title={q ? "Kh?ng t?m th?y s?n ph?m" : "B?n mu?n t?m g??"} description={q ? "Ki?m tra l?i ch?nh t?, d?ng t? kh?a ng?n h?n ho?c xem to?n b? danh m?c." : "Nh?p t?n s?n ph?m, th??ng hi?u ho?c danh m?c ?? b?t ??u t?m ki?m."} actionLabel="Kh?m ph? s?n ph?m" actionHref="/products" />}</div>
    </Container>
  );
}
