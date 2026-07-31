import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { ProductGrid } from "@/components/commerce/product-grid";
import { SearchBox } from "@/components/commerce/search-box";
import { StatePanel } from "@/components/feedback/state-panel";

export const metadata: Metadata = { title: "Tìm kiếm" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const products = await commerceRepository.getProducts({ query: q });
  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: "Tìm kiếm" }]} />
      <div className="mt-6 max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Kết quả tìm kiếm</h1><SearchBox defaultValue={q} className="mt-5" /></div>
      {q ? <p className="mt-8 border-b pb-5 text-sm text-muted-foreground">Tìm thấy <span className="font-semibold text-foreground">{products.length}</span> kết quả cho “{q}”</p> : null}
      <div className="mt-8">{q && products.length ? <ProductGrid products={products} /> : <StatePanel kind="notFound" title={q ? "Không tìm thấy sản phẩm" : "Bạn muốn tìm gì?"} description={q ? "Hãy kiểm tra chính tả, thử từ khóa ngắn hơn hoặc xem toàn bộ danh mục." : "Nhập tên sản phẩm, thương hiệu hoặc danh mục để bắt đầu tìm kiếm."} actionLabel="Khám phá sản phẩm" actionHref="/products" />}</div>
    </Container>
  );
}
