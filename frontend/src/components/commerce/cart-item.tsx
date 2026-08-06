"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { QuantitySelector } from "@/components/commerce/quantity-selector";
import { PriceDisplay } from "@/components/commerce/price-display";
import { Button } from "@/components/ui/button";
import type { CartItem as CartItemType } from "@/types/cart";

const MAX_CART_ITEM_QUANTITY = 999;

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  isUpdating,
  isRemoving,
}: {
  item: CartItemType;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}) {
  const pending = isUpdating || isRemoving;
  const detailHref = `/products/${item.slug}`;

  return (
    <article className="grid grid-cols-[88px_1fr] gap-4 rounded-2xl border bg-card p-3 sm:grid-cols-[120px_1fr_auto] sm:p-4">
      <Link href={detailHref} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {item.image ? (
          <Image src={item.image} alt={item.productName} fill sizes="120px" className="object-cover" />
        ) : null}
      </Link>

      <div className="min-w-0 py-1">
        <Link href={detailHref} className="line-clamp-2 font-semibold hover:text-primary">
          {item.productName}
        </Link>
        {item.selectedOptions && item.selectedOptions.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{item.selectedOptions.join(" · ")}</p>
        ) : null}
        {!item.available ? (
          <p className="mt-1 text-sm font-medium text-destructive">
            {item.unavailableReason ?? "Sản phẩm không còn khả dụng"}
          </p>
        ) : null}
        <PriceDisplay price={item.unitPrice} size="sm" className="mt-3" />
        <div className="mt-4 sm:hidden">
          <QuantitySelector
            value={item.quantity}
            onChange={onQuantityChange}
            max={item.available ? MAX_CART_ITEM_QUANTITY : item.quantity}
            disabled={pending}
          />
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 border-t pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-1">
        <div className="hidden sm:block">
          <QuantitySelector
            value={item.quantity}
            onChange={onQuantityChange}
            max={item.available ? MAX_CART_ITEM_QUANTITY : item.quantity}
            disabled={pending}
          />
        </div>
        <p className="font-semibold">{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.lineTotal)}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          aria-label={`Xóa ${item.productName} khỏi giỏ hàng`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
          Xóa
        </Button>
      </div>
    </article>
  );
}
