"use client";

import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductDetail } from "@/lib/hooks/use-product-detail";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchasePanel } from "@/components/product/product-purchase-panel";
import { ProductInfoTabs } from "@/components/product/product-info-tabs";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductDetailSkeleton, ProductDetailError } from "@/components/product/product-detail-states";
import { selectGalleryImages } from "@/lib/product/gallery-images";
import { resolveVariant, buildInitialSelection } from "@/lib/product/variant-resolver";

/** Ch14-B127: composes the whole detail page from the real, per-resource API responses. */
export function ProductDetailView({ slug }: { slug: string }) {
  const {
    product,
    variants,
    images,
    options,
    attributes,
    isProductLoading,
    isProductError,
    productErrorStatus,
    isDependentLoading,
    isDependentError,
    refetchProduct,
    refetchDependents,
  } = useProductDetail(slug);

  if (isProductLoading) return <ProductDetailSkeleton />;

  if (isProductError) {
    if (productErrorStatus === 404) notFound();
    return <ProductDetailError onRetry={() => void refetchProduct()} />;
  }

  if (!product) return null;

  // Which variant is "selected" for the gallery's image-by-variant swap:
  // mirrors the purchase panel's own default selection so the main image
  // matches what the panel shows on first render.
  const initialSelection = buildInitialSelection(options, variants);
  const initialVariant = resolveVariant(variants, initialSelection);
  const galleryImages = selectGalleryImages(images, initialVariant?.id);

  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs
        items={[
          ...(product.category ? [{ label: product.category.name, href: `/products?category=${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <div className="mt-7 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        <div>
          {isDependentLoading ? (
            <Skeleton className="aspect-square w-full rounded-2xl" />
          ) : (
            <ProductGallery images={galleryImages} productName={product.name} />
          )}
        </div>
        <div>
          {product.category ? <p className="text-sm font-semibold text-primary">{product.category.name}</p> : null}
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{product.name}</h1>
          {product.shortDescription ? <p className="mt-3 leading-6 text-muted-foreground">{product.shortDescription}</p> : null}
          <Separator className="my-6" />
          {isDependentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : isDependentError ? (
            <ProductDetailError onRetry={() => void refetchDependents()} />
          ) : (
            <ProductPurchasePanel product={product} options={options} variants={variants} />
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl border p-4 text-sm">
              <RotateCcw className="size-5 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Đổi trả trong 30 ngày</p>
                <p className="mt-1 text-muted-foreground">Áp dụng theo điều kiện sản phẩm</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border p-4 text-sm">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Bảo hành chính hãng</p>
                <p className="mt-1 text-muted-foreground">Tiếp nhận và theo dõi minh bạch</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 border-t pt-12">
        <h2 className="text-2xl font-semibold tracking-[-0.035em]">Thông tin sản phẩm</h2>
        <div className="mt-6">
          <ProductInfoTabs description={product.description} attributes={attributes} />
        </div>
      </div>

      {product.category ? (
        <section className="mt-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-[-0.035em]">Có thể bạn cũng thích</h2>
          <RelatedProducts categoryId={product.category.id} excludeProductId={product.id} />
        </section>
      ) : null}
    </Container>
  );
}
