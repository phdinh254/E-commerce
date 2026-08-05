import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatVnd } from "@/components/commerce/price-display";
import type { CatalogProduct } from "@/types/catalog";

/**
 * Built for the real `ProductResponseDto` shape only — no brand, rating,
 * stock, sale price, or variant summary, because the list endpoint
 * doesn't return any of those (see backend/.../dto/product-response.dto.ts).
 * Deliberately a SEPARATE component from `@/components/commerce/product-card`
 * (which still backs the mock-data-driven home page and product detail
 * page — see docs/catalog.md) rather than repurposing it: that card's
 * props require fields (brand, rating, stockStatus, originalPrice) the
 * real API never sends, and changing its contract would break those
 * still-mock call sites, which are out of Chapter 13's scope.
 *
 * Plain `<img>`, not `next/image`: thumbnailUrl is an arbitrary external
 * URL (Supabase signed URL or whatever an admin sets) with no fixed host
 * to allowlist in next.config.ts's remotePatterns, and hardcoding a
 * wildcard host defeats the point of that allowlist.
 */
export function CatalogProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="group min-w-0">
      <Link
        href={`/products/${product.slug}`}
        className="block aspect-square overflow-hidden rounded-2xl border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, host-unknown URL; see class comment
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground" aria-hidden="true">
            <ImageOff className="size-8" />
          </div>
        )}
      </Link>
      <div className="pt-4">
        {product.category ? (
          <p className="text-xs font-medium text-muted-foreground">{product.category.name}</p>
        ) : null}
        <Link
          href={`/products/${product.slug}`}
          className="mt-1 line-clamp-2 block min-h-12 rounded-sm text-base font-semibold leading-6 tracking-[-0.015em] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {product.name}
        </Link>
        <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
          {formatVnd(product.price)}
        </p>
      </div>
    </article>
  );
}
