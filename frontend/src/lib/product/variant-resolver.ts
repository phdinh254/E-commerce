import type { ProductDetail, ProductOption, ProductVariant } from "@/types/product-detail";

/** optionId -> selected valueId. Always resolved from IDs, never from display labels. */
export type VariantSelection = Record<string, string>;

/**
 * A variant "matches" a selection when the selection assigns exactly the
 * variant's own option values — no more, no fewer. This guards against a
 * partial selection (user picked color but not size yet) resolving to some
 * arbitrary variant that happens to share the one selected value.
 */
export function resolveVariant(
  variants: ProductVariant[],
  selection: VariantSelection,
): ProductVariant | undefined {
  const selectedEntries = Object.entries(selection).filter(([, valueId]) => valueId);
  if (selectedEntries.length === 0) return undefined;

  return variants.find((variant) => {
    if (variant.optionValues.length !== selectedEntries.length) return false;
    return variant.optionValues.every((ov) => selection[ov.optionId] === ov.valueId);
  });
}

/** The default selection: the first available (isActive, stock > 0) variant if one exists, else the first variant. */
export function buildInitialSelection(
  options: ProductOption[],
  variants: ProductVariant[],
): VariantSelection {
  const preferred = variants.find((v) => v.isActive && v.stock > 0) ?? variants[0];
  if (!preferred) return {};
  const selection: VariantSelection = {};
  for (const ov of preferred.optionValues) selection[ov.optionId] = ov.valueId;
  // Ensure every declared option has a key (even if the preferred variant
  // omitted one — shouldn't happen given backend combination rules, but keeps
  // the selector's fieldsets consistent instead of silently blank).
  for (const option of options) {
    if (!(option.id in selection)) selection[option.id] = "";
  }
  return selection;
}

/**
 * A given (optionId, valueId) combination is choosable only if there exists
 * at least one *active* variant carrying it, combined with whatever is
 * already selected for the other options. Used to disable/grey out value
 * buttons that have no reachable variant.
 */
export function isValueReachable(
  variants: ProductVariant[],
  selection: VariantSelection,
  optionId: string,
  valueId: string,
): boolean {
  const candidateSelection: VariantSelection = { ...selection, [optionId]: valueId };
  return variants.some((variant) => {
    if (!variant.isActive) return false;
    return variant.optionValues.every((ov) => {
      const selected = candidateSelection[ov.optionId];
      return !selected || selected === ov.valueId;
    });
  });
}

/** Price shown for the current selection — the resolved variant's price, falling back to the base product price only when there is no variant to resolve (product has no options at all). */
export function getEffectivePrice(product: ProductDetail, variant: ProductVariant | undefined): number {
  return variant ? variant.price : product.price;
}

/**
 * Stock is only known at the variant level in this backend (ProductEntity
 * has no stock/inventory column of its own — see product.entity.ts). When
 * the product has no variants at all there is genuinely no stock signal;
 * callers must not invent one (see docs note in product-purchase-panel.tsx).
 */
export function getEffectiveStock(variant: ProductVariant | undefined): number | null {
  return variant ? variant.stock : null;
}
