"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QuantitySelector } from "@/components/commerce/quantity-selector";
import { PriceDisplay } from "@/components/commerce/price-display";
import { OrderSummary } from "@/components/commerce/order-summary";
import { StatePanel } from "@/components/feedback/state-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mockProducts } from "@/lib/data/mock-data";

interface CartLine { productId: string; variant: string; quantity: number; }
const initialLines: CartLine[] = [{ productId: "prod-headphones", variant: "Xanh cobalt", quantity: 1 }, { productId: "prod-bottle", variant: "600 ml", quantity: 2 }];

export function CartContent() {
  const [lines, setLines] = useState(initialLines);
  const detailed = lines.flatMap((line) => { const product = mockProducts.find((item) => item.id === line.productId); return product ? [{ ...line, product }] : []; });
  const subtotal = useMemo(() => detailed.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [detailed]);
  if (!detailed.length) return <StatePanel kind="empty" title="Giỏ hàng đang trống" description="Khám phá sản phẩm và thêm lựa chọn phù hợp vào giỏ hàng." actionLabel="Tiếp tục mua sắm" actionHref="/products" />;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-3">{detailed.map((line) => <article key={`${line.productId}-${line.variant}`} className="grid grid-cols-[88px_1fr] gap-4 rounded-2xl border bg-card p-3 sm:grid-cols-[120px_1fr_auto] sm:p-4"><Link href={`/products/${line.product.slug}`} className="relative aspect-square overflow-hidden rounded-xl bg-muted"><Image src={line.product.image} alt={line.product.name} fill sizes="120px" className="object-cover" /></Link><div className="min-w-0 py-1"><Link href={`/products/${line.product.slug}`} className="line-clamp-2 font-semibold hover:text-primary">{line.product.name}</Link><p className="mt-1 text-sm text-muted-foreground">{line.variant}</p><PriceDisplay price={line.product.price} size="sm" className="mt-3" /><div className="mt-4 sm:hidden"><QuantitySelector value={line.quantity} onChange={(quantity) => setLines((current) => current.map((item) => item === line ? { ...item, quantity } : item))} max={line.product.stock} /></div></div><div className="col-span-2 flex items-center justify-between gap-3 border-t pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-1"><div className="hidden sm:block"><QuantitySelector value={line.quantity} onChange={(quantity) => setLines((current) => current.map((item) => item === line ? { ...item, quantity } : item))} max={line.product.stock} /></div><p className="font-semibold">{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(line.product.price * line.quantity)}</p><Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { setLines((current) => current.filter((item) => item !== line)); toast.success("Đã xóa sản phẩm khỏi giỏ hàng."); }}><Trash2 aria-hidden="true" />Xóa</Button></div></article>)}</div>
      <div className="lg:sticky lg:top-28"><OrderSummary subtotal={subtotal} shippingFee={0} total={subtotal} action={<><Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "w-full")}>Tiến hành thanh toán</Link><Link href="/products" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "mt-2 w-full")}>Tiếp tục mua sắm</Link></>} /></div>
    </div>
  );
}
