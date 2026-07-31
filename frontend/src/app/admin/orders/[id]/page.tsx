import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, ReceiptText, Truck } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { mockOrders } from "@/lib/data/mock-data";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/commerce/status-badge";
import { OrderSummary } from "@/components/commerce/order-summary";
import { formatVnd } from "@/components/commerce/price-display";
import { OrderStatusControl } from "@/components/admin/order-status-control";

export function generateStaticParams() { return mockOrders.map((order) => ({ id: order.id })); }
export const metadata: Metadata = { title: "X? l? ??n h?ng" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await commerceRepository.getOrder(id);
  if (!order) notFound();
  return <div className="mx-auto max-w-[1400px]"><PageHeader title={`??n h?ng ${order.code}`} description="Ki?m tra thanh to?n, ??a ch?, s?n ph?m v? c?p nh?t tr?ng th?i h?p l?." action={<StatusBadge status={order.status} />} /><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start"><div className="space-y-6"><section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">S?n ph?m trong ??n</h2><div className="mt-4 divide-y">{order.items.map((item) => <div key={item.id} className="flex gap-4 py-4"><div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"><Image src={item.image} alt={item.productName} fill sizes="80px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="font-medium">{item.productName}</p><p className="mt-1 text-sm text-muted-foreground">Snapshot: {item.variant}</p><p className="mt-2 text-sm">{formatVnd(item.unitPrice)} x {item.quantity}</p></div><p className="hidden font-semibold sm:block">{formatVnd(item.unitPrice * item.quantity)}</p></div>)}</div><p className="mt-4 rounded-xl bg-muted p-4 text-xs leading-5 text-muted-foreground">T?n, bi?n th? v? ??n gi? hi?n th? t? snapshot c?a ??n h?ng, kh?ng ??c l?i d? li?u s?n ph?m hi?n t?i.</p></section><div className="grid gap-4 md:grid-cols-3"><section className="rounded-2xl border bg-card p-5"><MapPin className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-3 font-semibold">Ng??i nh?n</h2><p className="mt-3 text-sm font-medium">{order.recipientName}</p><p className="mt-1 text-sm text-muted-foreground">{order.phoneNumber}</p><p className="mt-2 text-sm leading-6">{order.shippingAddress}</p></section><section className="rounded-2xl border bg-card p-5"><ReceiptText className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-3 font-semibold">Thanh to?n</h2><p className="mt-3 text-sm">PayOS</p><p className="mt-1 text-sm text-muted-foreground">{order.paymentStatus}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Ch? webhook PayOS h?p l? m?i x?c nh?n thanh to?n.</p></section><section className="rounded-2xl border bg-card p-5"><Truck className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-3 font-semibold">V?n chuy?n</h2><p className="mt-3 text-sm">{order.shippingMethod}</p><p className="mt-1 text-sm text-muted-foreground">{order.trackingCode ?? "Ch?a c? m? v?n ??n"}</p></section></div></div><aside className="space-y-5 xl:sticky xl:top-24"><OrderStatusControl initialStatus={order.status} /><OrderSummary subtotal={order.subtotal} shippingFee={order.shippingFee} discount={order.discount} total={order.total} /></aside></div></div>;
}
