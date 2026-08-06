"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/commerce/quantity-selector";
import { ProductVariantSelector } from "@/components/product/product-variant-selector";
import { formatVnd } from "@/components/commerce/price-display";
import {
  buildInitialSelection,
  getEffectivePrice,
  getEffectiveStock,
  resolveVariant,
} from "@/lib/product/variant-resolver";
import type { VariantSelection } from "@/lib/product/variant-resolver";
import type { ProductDetail, ProductOption, ProductVariant } from "@/types/product-detail";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAddCartItem } from "@/lib/hooks/use-add-cart-item";
import { getApiErrorMessage } from "@/lib/api/client";

const DEFAULT_MAX_QUANTITY_WITHOUT_VARIANTS = 99;

/**
 * Ch15-B147: wired to the real Cart API. Guest clicks never call the Cart
 * API — they navigate to /login with a safe `redirect` back to this exact
 * product page (consumed by AuthForm via getSafeRedirectPath, already
 * wired). An authenticated click sends only productId/variantId/quantity;
 * price is never sent (the backend rejects unknown fields).
 */
export function ProductPurchasePanel({
  product,
  options,
  variants,
}: {
  product: ProductDetail;
  options: ProductOption[];
  variants: ProductVariant[];
}) {
  const [selection, setSelection] = useState<VariantSelection>(() => buildInitialSelection(options, variants));
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();
  const pathname = usePathname();
  const { status: authStatus } = useAuth();
  const addCartItem = useAddCartItem();

  const resolvedVariant = useMemo(() => resolveVariant(variants, selection), [variants, selection]);
  const hasVariants = variants.length > 0;
  const selectionComplete = !hasVariants || Boolean(resolvedVariant);

  const price = getEffectivePrice(product, resolvedVariant);
  const stock = getEffectiveStock(resolvedVariant);
  const maxQuantity = stock !== null ? stock : DEFAULT_MAX_QUANTITY_WITHOUT_VARIANTS;
  const soldOut = hasVariants && selectionComplete && stock === 0;

  function handleSelect(optionId: string, valueId: string) {
    setSelection((prev) => ({ ...prev, [optionId]: valueId }));
    setQuantity(1);
  }

  function handleAddToCart() {
    if (authStatus !== "authenticated") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    addCartItem.mutate(
      {
        productId: product.id,
        variantId: resolvedVariant?.id,
        quantity,
      },
      {
        onSuccess: () => toast.success("Đã thêm vào giỏ hàng."),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{formatVnd(price)}</p>

      <ProductVariantSelector options={options} variants={variants} selection={selection} onSelect={handleSelect} />

      {hasVariants && !selectionComplete ? (
        <p className="text-sm text-muted-foreground">Vui lòng chọn đầy đủ tùy chọn để xem tình trạng còn hàng.</p>
      ) : null}

      <div>
        <p className="mb-3 text-sm font-semibold">Số lượng</p>
        <QuantitySelector
          value={Math.min(quantity, Math.max(1, maxQuantity))}
          onChange={(next) => setQuantity(Math.max(1, Math.min(next, Math.max(1, maxQuantity))))}
          max={Math.max(1, maxQuantity)}
          disabled={soldOut || !selectionComplete}
        />
      </div>

      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full"
          disabled={soldOut || !selectionComplete || addCartItem.isPending}
          onClick={handleAddToCart}
        >
          <ShoppingBag aria-hidden="true" />
          {addCartItem.isPending ? "Đang thêm..." : "Thêm vào giỏ hàng"}
        </Button>
      </div>

      {soldOut ? (
        <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Sản phẩm đang tạm hết hàng với tùy chọn đã chọn.
        </p>
      ) : null}
    </div>
  );
}
