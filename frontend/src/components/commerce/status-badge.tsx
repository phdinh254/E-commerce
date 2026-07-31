import { cn } from "@/lib/utils";
import type { OrderStatus, ProductStockStatus } from "@/types/commerce";

const labels: Record<string, string> = {
  NEW: "??n m?i",
  PENDING_PAYMENT: "Ch? thanh to?n",
  PAID: "?? thanh to?n",
  PROCESSING: "?ang x? l?",
  SHIPPED: "?ang giao",
  DELIVERED: "?? giao",
  CANCELLED: "?? h?y",
  IN_STOCK: "C?n h?ng",
  LOW_STOCK: "S?p h?t h?ng",
  OUT_OF_STOCK: "H?t h?ng",
};

export function StatusBadge({ status, className }: { status: OrderStatus | ProductStockStatus | string; className?: string }) {
  const tone = status === "DELIVERED" || status === "PAID" || status === "IN_STOCK" ? "bg-success/12 text-success dark:bg-success/18" : status === "CANCELLED" || status === "OUT_OF_STOCK" || status === "FAILED" ? "bg-destructive/10 text-destructive" : status === "PENDING_PAYMENT" || status === "LOW_STOCK" ? "bg-warning/16 text-warning-foreground dark:text-warning" : "bg-accent text-accent-foreground";
  return <span className={cn("inline-flex min-h-7 items-center rounded-lg px-2.5 py-1 text-xs font-semibold", tone, className)}>{labels[status] ?? status}</span>;
}
