"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/commerce/quantity-selector";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/commerce";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const availableVariants = product.variants.filter((variant) => variant.available);
  const [variantId, setVariantId] = useState(availableVariants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();
  const soldOut = product.stockStatus === "OUT_OF_STOCK";
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold">{product.variants[0]?.name ?? "Phi?n b?n"}</p>
        <div className="flex flex-wrap gap-2">{product.variants.map((variant) => <button key={variant.id} type="button" disabled={!variant.available || soldOut} aria-pressed={variantId === variant.id} onClick={() => setVariantId(variant.id)} className={cn("min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors", variantId === variant.id ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:border-primary/50", (!variant.available || soldOut) && "cursor-not-allowed opacity-45 line-through")}>{variant.value}{variantId === variant.id ? <Check className="ml-2 inline size-4" aria-hidden="true" /> : null}</button>)}</div>
      </div>
      <div><p className="mb-3 text-sm font-semibold">S? l??ng</p><QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, product.stock)} disabled={soldOut} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" variant="outline" disabled={soldOut || !variantId} onClick={() => toast.success(`?? th?m ${quantity} ${product.name} v?o gi? h?ng.`)}><ShoppingBag aria-hidden="true" />Th?m v?o gi?</Button>
        <Button size="lg" disabled={soldOut || !variantId} onClick={() => router.push("/checkout")}>Mua ngay</Button>
      </div>
      {soldOut ? <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">S?n ph?m ?ang t?m h?t h?ng. B?n ch?a th? th?m v?o gi? ho?c mua ngay.</p> : <div className="flex gap-3 rounded-xl bg-muted p-4 text-sm"><Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><p className="font-semibold">D? ki?n giao trong 2 ??n 4 ng?y</p><p className="mt-1 text-muted-foreground">Mi?n ph? v?n chuy?n cho ??n h?ng n?y.</p></div></div>}
    </div>
  );
}
