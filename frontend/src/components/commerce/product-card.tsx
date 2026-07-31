"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/commerce/price-display";
import { RatingDisplay } from "@/components/commerce/rating-display";
import { StatusBadge } from "@/components/commerce/status-badge";
import type { Product } from "@/types/commerce";

export function ProductCard({ product }: { product: Product }) {
  const unavailable = product.stockStatus === "OUT_OF_STOCK";
  return (
    <article className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
        <Link href={`/products/${product.slug}`} className="block size-full">
          <Image src={product.image} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
        </Link>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.isNew ? <span className="rounded-lg bg-card/95 px-2 py-1 text-[11px] font-semibold shadow-sm">Mới</span> : null}
          {unavailable ? <StatusBadge status="OUT_OF_STOCK" /> : null}
        </div>
        <Button type="button" size="icon-lg" aria-label={`Thêm ${product.name} vào giỏ`} disabled={unavailable} onClick={() => toast.success(`Đã thêm ${product.name} vào giỏ hàng.`)} className="absolute bottom-3 right-3 shadow-soft sm:translate-y-2 sm:opacity-0 sm:transition-all sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"><ShoppingBag aria-hidden="true" /></Button>
      </div>
      <div className="pt-4">
        <p className="text-xs font-medium text-muted-foreground">{product.brand}</p>
        <Link href={`/products/${product.slug}`} className="mt-1 line-clamp-2 block min-h-12 rounded-sm text-base font-semibold leading-6 tracking-[-0.015em] hover:text-primary">{product.name}</Link>
        <RatingDisplay rating={product.rating} count={product.reviewCount} compact className="mt-2" />
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} className="mt-2" />
      </div>
    </article>
  );
}
