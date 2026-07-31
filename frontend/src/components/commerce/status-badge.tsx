import { cn } from "@/lib/utils";
import type { OrderStatus, ProductStockStatus } from "@/types/commerce";

const labels: Record<string, string> = {
  NEW: "Đơn mới",
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PROCESSING: "Đang xử lý",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  IN_STOCK: "Còn hàng",
  LOW_STOCK: "Sắp hết hàng",
  OUT_OF_STOCK: "Hết hàng",
};

export function StatusBadge({ status, className }: { status: OrderStatus | ProductStockStatus | string; className?: string }) {
  const tone = status === "DELIVERED" || status === "PAID" || status === "IN_STOCK" ? "bg-success/12 text-success dark:bg-success/18" : status === "CANCELLED" || status === "OUT_OF_STOCK" || status === "FAILED" ? "bg-destructive/10 text-destructive" : status === "PENDING_PAYMENT" || status === "LOW_STOCK" ? "bg-warning/16 text-warning-foreground dark:text-warning" : "bg-accent text-accent-foreground";
  return <span className={cn("inline-flex min-h-7 items-center rounded-lg px-2.5 py-1 text-xs font-semibold", tone, className)}>{labels[status] ?? status}</span>;
}
