"use client";

import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
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

const DEFAULT_MAX_QUANTITY_WITHOUT_VARIANTS = 99;

/**
 * Ch14-B132: quantity selector and add-to-cart action.
 *
 * The backend has no Cart module at all yet (audited: no `backend/src/modules/cart`,
 * no cart entity, no cart endpoint anywhere) and building one from scratch
 * requires business decisions this task cannot make unilaterally (guest
 * cart TTL/merge policy beyond the existing generic guest session,
 * idempotency-key convention for the add endpoint, stock re-validation
 * policy at add-time vs. checkout-time) plus a DB migration that can't be
 * run or verified in this environment (no Postgres reachable — `docker ps`
 * returned no containers). Per the task's own explicit fallback, this is
 * reported BỊ CHẶN for persistence rather than faked with localStorage or a
 * toast that lies about success. The quantity selector and variant
 * resolution below are fully real and functional; only the final
 * "persist to a cart" step is blocked.
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
          disabled
          aria-disabled="true"
          title="Giỏ hàng chưa khả dụng — backend chưa có Cart module (xem ghi chú Ch14-B132)."
        >
          <ShoppingBag aria-hidden="true" />
          Thêm vào giỏ hàng
        </Button>
        <p className="text-xs text-muted-foreground" role="status">
          Chức năng giỏ hàng đang được xây dựng và chưa khả dụng ở phiên bản này.
        </p>
      </div>

      {soldOut ? (
        <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          Sản phẩm đang tạm hết hàng với tùy chọn đã chọn.
        </p>
      ) : null}
    </div>
  );
}
