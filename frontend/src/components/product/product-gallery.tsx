"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/product-detail";

/**
 * Plain <img>, not next/image: `url` is a freshly-signed URL from a private
 * bucket (see ProductImage doc comment) with a host that isn't fixed enough
 * to allowlist in next.config's images.remotePatterns — same reasoning as
 * CatalogProductCard (Ch13).
 */
export function ProductGallery({ images, productName }: { images: ProductImage[]; productName: string }) {
  const [activeId, setActiveId] = useState<string | undefined>(images[0]?.id);

  // Derived, not effect-driven: when the image set changes (variant swap)
  // and the previously active id is no longer present, fall back to the
  // first image of the new set for this render directly, instead of
  // committing a stale image for one frame and correcting it in an effect.
  const active =
    images.find((image) => image.id === activeId) ?? images[0];

  if (images.length === 0) {
    return (
      <div className="grid aspect-square place-items-center rounded-2xl border bg-muted text-muted-foreground" aria-label={`${productName}, chưa có ảnh`}>
        <ImageOff className="size-10" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[92px_1fr]">
      <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col" role="tablist" aria-label="Ảnh sản phẩm">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            role="tab"
            aria-selected={image.id === active?.id}
            aria-label={`Xem ảnh ${index + 1}${image.altText ? `: ${image.altText}` : ""}`}
            onClick={() => setActiveId(image.id)}
            className={cn(
              "relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border bg-muted transition-colors sm:w-full",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              image.id === active?.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, unknown host; see file doc comment */}
            <img
              src={image.url}
              alt={image.altText ?? `${productName}, ảnh ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <div className="relative order-1 aspect-square overflow-hidden rounded-2xl border bg-muted sm:order-2">
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, unknown host; see file doc comment
          <img
            src={active.url}
            alt={active.altText ?? productName}
            className="size-full object-cover"
            // Only the primary, above-the-fold image is eagerly loaded — not every thumbnail.
            loading="eager"
            fetchPriority="high"
          />
        ) : null}
      </div>
    </div>
  );
}
