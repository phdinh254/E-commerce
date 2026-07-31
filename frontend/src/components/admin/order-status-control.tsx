"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { OrderStatus } from "@/types/commerce";

export function OrderStatusControl({ initialStatus }: { initialStatus: OrderStatus }) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  return <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Cập nhật trạng thái</h2><div className="mt-4 space-y-2"><Label htmlFor="order-status">Trạng thái đơn hàng</Label><select id="order-status" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="NEW">Đơn mới</option><option value="PENDING_PAYMENT">Chờ thanh toán</option><option value="PAID">Đã thanh toán</option><option value="PROCESSING">Đang xử lý</option><option value="SHIPPED">Đang giao</option><option value="DELIVERED">Đã giao</option><option value="CANCELLED">Đã hủy</option></select></div><Button className="mt-4 w-full" disabled={saving} onClick={async () => { setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); toast.success("Đã cập nhật trạng thái trong bản dùng thử."); }}>{saving ? "Đang lưu..." : "Lưu trạng thái"}</Button><p className="mt-3 text-xs leading-5 text-muted-foreground">Trạng thái chỉ có thể chuyển theo quy trình xử lý đơn hàng hợp lệ.</p></div>;
}
