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
  return product ? { title: product.name, description: product.description } : { title: "Kh?ng t?m th?y s?n ph?m" };
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
          <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{product.gallery.map((image, index) => <div key={`${image}-${index}`} className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border bg-muted sm:w-full"><Image src={image} alt={`${product.name}, ?nh ${index + 1}`} fill sizes="100px" className="object-cover" /></div>)}</div>
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-xl border p-4 text-sm"><RotateCcw className="size-5 text-primary" aria-hidden="true" /><div><p className="font-semibold">??i tr? 30 ng?y</p><p className="mt-1 text-muted-foreground">?p d?ng theo ?i?u ki?n s?n ph?m</p></div></div><div className="flex gap-3 rounded-xl border p-4 text-sm"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><div><p className="font-semibold">B?o h?nh ch?nh h?ng</p><p className="mt-1 text-muted-foreground">Ti?p nh?n v? theo d?i r? r?ng</p></div></div></div>
        </div>
      </div>
      <div className="mt-16 grid gap-10 border-t pt-12 lg:grid-cols-[0.7fr_1.3fr]"><div><h2 className="text-2xl font-semibold tracking-[-0.035em]">Th?ng tin s?n ph?m</h2><p className="mt-3 leading-7 text-muted-foreground">Th?ng s? ???c tr?nh b?y theo nh?m ?? d? so s?nh tr??c khi mua.</p></div><dl className="grid gap-3 sm:grid-cols-2">{product.specifications.map((spec) => <div key={spec.label} className="rounded-xl bg-muted p-4"><dt className="text-xs font-medium text-muted-foreground">{spec.label}</dt><dd className="mt-2 font-semibold">{spec.value}</dd></div>)}</dl></div>
      <section className="mt-16"><h2 className="text-2xl font-semibold tracking-[-0.035em]">??nh gi? t? kh?ch h?ng</h2><div className="mt-6 grid gap-4 lg:grid-cols-[0.35fr_0.65fr]"><div className="rounded-2xl bg-primary p-6 text-primary-foreground"><p className="text-5xl font-semibold tracking-[-0.05em]">{product.rating.toFixed(1)}</p><p className="mt-2 text-sm opacity-80">T? {product.reviewCount} ??nh gi? ?? x?c minh</p></div><div className="rounded-2xl border bg-card p-6"><RatingDisplay rating={5} /><p className="mt-4 leading-7">S?n ph?m ho?n thi?n ch?c ch?n, s? d?ng d? v? giao h?ng ??ng th?i gian d? ki?n.</p><p className="mt-4 text-sm font-semibold">Tr?n Ho?i Ph??ng</p><p className="text-xs text-muted-foreground">?? mua h?ng</p></div></div></section>
      <section className="mt-16"><h2 className="mb-8 text-2xl font-semibold tracking-[-0.035em]">C? th? b?n c?ng th?ch</h2><ProductGrid products={related} /></section>
    </Container>
  );
}
