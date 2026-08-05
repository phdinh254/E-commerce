import type { Metadata } from "next";
import { isAxiosError } from "axios";
import { productsApi } from "@/lib/api/products";
import { ProductDetailView } from "@/components/product/product-detail-view";

/**
 * Server Component: fetches the product once via the real API for SEO
 * metadata only (title/description). The interactive body re-fetches
 * through `useProductDetail` (TanStack Query) — this repo has no
 * dehydrate/hydrate boundary set up yet (see Chapter 13's CatalogPage,
 * which is a plain client component with no SSR hydration either), so this
 * keeps the same pattern rather than introducing new SSR infra as a side
 * effect of Chapter 14. The extra GET is small (single product, not a list)
 * and is not exposed to the user as a loading state since the client view
 * has its own skeleton.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productsApi.getBySlug(slug);
    return {
      title: product.name,
      description: product.shortDescription ?? product.description ?? undefined,
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return { title: "Không tìm thấy sản phẩm" };
    }
    // Metadata generation must never crash the route on a transient backend
    // error — fall back to a generic title; the client view will surface
    // the real error state with a retry action.
    return { title: "Sản phẩm" };
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailView slug={slug} />;
}
