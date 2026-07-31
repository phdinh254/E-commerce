"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { OrderStatus } from "@/types/commerce";

export function OrderStatusControl({ initialStatus }: { initialStatus: OrderStatus }) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  return <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">C?p nh?t tr?ng th?i</h2><div className="mt-4 space-y-2"><Label htmlFor="order-status">Tr?ng th?i ??n h?ng</Label><select id="order-status" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="NEW">??n m?i</option><option value="PENDING_PAYMENT">Ch? thanh to?n</option><option value="PAID">?? thanh to?n</option><option value="PROCESSING">?ang x? l?</option><option value="SHIPPED">?ang giao</option><option value="DELIVERED">?? giao</option><option value="CANCELLED">?? h?y</option></select></div><Button className="mt-4 w-full" disabled={saving} onClick={async () => { setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); toast.success("?? c?p nh?t tr?ng th?i trong giao di?n m?u."); }}>{saving ? "?ang l?u..." : "L?u tr?ng th?i"}</Button><p className="mt-3 text-xs leading-5 text-muted-foreground">TODO(api): Backend c?n endpoint c?p nh?t tr?ng th?i v? state machine h?p l?.</p></div>;
}
