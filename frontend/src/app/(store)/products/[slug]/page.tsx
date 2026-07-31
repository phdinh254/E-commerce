import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { PriceDisplay } from "@/components/commerce/price-display";
import { RatingDisplay } from "@/components/commerce/rating-display";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ProductPurchasePanel } from "@/components/commerce/product-purchase-panel";
import { ProductGrid } from "@/components/commerce/product-grid";
import { Separator } from "@/components/ui/separator";
import { mockProducts } from "@/lib/data/mock-data";

export function generateStaticParams() { return mockProducts.map((product) => ({ slug: product.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await commerceRepository.getProduct(slug);
  return product ? { title: product.name, description: product.description } : { title: "Không tìm thấy sản phẩm" };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await commerceRepository.getProduct(slug);
  if (!product) notFound();
  const related = (await commerceRepository.getProducts()).filter((item) => item.id !== product.id).slice(0, 4);
  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: product.category, href: `/products?category=${product.categorySlug}` }, { label: product.name }]} />
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        <div className="grid gap-3 sm:grid-cols-[92px_1fr]">
          <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{product.gallery.map((image, index) => <div key={`${image}-${index}`} className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border bg-muted sm:w-full"><Image src={image} alt={`${product.name}, ảnh ${index + 1}`} fill sizes="100px" className="object-cover" /></div>)}</div>
          <div className="relative order-1 aspect-square overflow-hidden rounded-2xl border bg-muted sm:order-2"><Image src={product.image} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 52vw" className="object-cover" /></div>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">{product.brand}</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3"><RatingDisplay rating={product.rating} count={product.reviewCount} /><StatusBadge status={product.stockStatus} /></div>
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" className="mt-5" />
          <p className="mt-5 leading-7 text-muted-foreground">{product.description}</p>
          <Separator className="my-7" />
          <ProductPurchasePanel product={product} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-xl border p-4 text-sm"><RotateCcw className="size-5 text-primary" aria-hidden="true" /><div><p className="font-semibold">Đổi trả trong 30 ngày</p><p className="mt-1 text-muted-foreground">Áp dụng theo điều kiện sản phẩm</p></div></div><div className="flex gap-3 rounded-xl border p-4 text-sm"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><div><p className="font-semibold">Bảo hành chính hãng</p><p className="mt-1 text-muted-foreground">Tiếp nhận và theo dõi minh bạch</p></div></div></div>
        </div>
      </div>
      <div className="mt-16 grid gap-10 border-t pt-12 lg:grid-cols-[0.7fr_1.3fr]"><div><h2 className="text-2xl font-semibold tracking-[-0.035em]">Thông tin sản phẩm</h2><p className="mt-3 leading-7 text-muted-foreground">Thông số được sắp xếp theo nhóm để bạn dễ so sánh trước khi mua.</p></div><dl className="grid gap-3 sm:grid-cols-2">{product.specifications.map((spec) => <div key={spec.label} className="rounded-xl bg-muted p-4"><dt className="text-xs font-medium text-muted-foreground">{spec.label}</dt><dd className="mt-2 font-semibold">{spec.value}</dd></div>)}</dl></div>
      <section className="mt-16"><h2 className="text-2xl font-semibold tracking-[-0.035em]">Đánh giá từ khách hàng</h2><div className="mt-6 grid gap-4 lg:grid-cols-[0.35fr_0.65fr]"><div className="rounded-2xl bg-primary p-6 text-primary-foreground"><p className="text-5xl font-semibold tracking-[-0.05em]">{product.rating.toFixed(1)}</p><p className="mt-2 text-sm opacity-80">Từ {product.reviewCount} đánh giá đã xác minh</p></div><div className="rounded-2xl border bg-card p-6"><RatingDisplay rating={5} /><p className="mt-4 leading-7">Sản phẩm hoàn thiện chắc chắn, dễ sử dụng và được giao đúng thời gian dự kiến.</p><p className="mt-4 text-sm font-semibold">Trần Hoài Phương</p><p className="text-xs text-muted-foreground">Đã mua hàng</p></div></div></section>
      <section className="mt-16"><h2 className="mb-8 text-2xl font-semibold tracking-[-0.035em]">Có thể bạn cũng thích</h2><ProductGrid products={related} /></section>
    </Container>
  );
}
