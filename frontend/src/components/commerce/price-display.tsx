import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
export function formatVnd(value: number): string { return formatter.format(value); }

export function PriceDisplay({ price, originalPrice, className, size = "default" }: { price: number; originalPrice?: number; className?: string; size?: "sm" | "default" | "lg" }) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-semibold tracking-[-0.02em] text-foreground", size === "sm" && "text-sm", size === "default" && "text-lg", size === "lg" && "text-2xl sm:text-3xl")}>{formatVnd(price)}</span>
      {originalPrice && originalPrice > price ? <span className="text-sm text-muted-foreground line-through">{formatVnd(originalPrice)}</span> : null}
    </div>
  );
}
