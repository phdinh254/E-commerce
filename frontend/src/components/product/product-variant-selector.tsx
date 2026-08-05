"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValueReachable } from "@/lib/product/variant-resolver";
import type { VariantSelection } from "@/lib/product/variant-resolver";
import type { ProductOption, ProductVariant } from "@/types/product-detail";

/**
 * One <fieldset>/<legend> per option (e.g. "Màu sắc"), value buttons resolve
 * by option-value ID — never by matching display label text — so two
 * options that happen to render the same label never collide.
 */
export function ProductVariantSelector({
  options,
  variants,
  selection,
  onSelect,
  disabled = false,
}: {
  options: ProductOption[];
  variants: ProductVariant[];
  selection: VariantSelection;
  onSelect: (optionId: string, valueId: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-5">
      {[...options].sort((a, b) => a.displayOrder - b.displayOrder).map((option) => (
        <fieldset key={option.id} disabled={disabled}>
          <legend className="mb-3 text-sm font-semibold">{option.name}</legend>
          <div className="flex flex-wrap gap-2">
            {[...option.values].sort((a, b) => a.displayOrder - b.displayOrder).map((value) => {
              const isSelected = selection[option.id] === value.id;
              const reachable = isValueReachable(variants, selection, option.id, value.id);
              return (
                <button
                  key={value.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={disabled || !reachable}
                  onClick={() => onSelect(option.id, value.id)}
                  className={cn(
                    "min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:border-primary/50",
                    !reachable && "cursor-not-allowed opacity-45 line-through",
                  )}
                >
                  {value.value}
                  {isSelected ? <Check className="ml-2 inline size-4" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
