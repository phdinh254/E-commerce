import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Circle, MapPin, Package, ReceiptText, Truck } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/commerce/status-badge";
import { OrderSummary } from "@/components/commerce/order-summary";
import { formatVnd } from "@/components/commerce/price-display";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { mockOrders } from "@/lib/data/mock-data";

export function generateStaticParams() { return mockOrders.map((order) => ({ id: order.id })); }
export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

const stages = [
  { status: "NEW", label: "Đơn hàng đã tạo" },
  { status: "PAID", label: "Thanh toán đã xác nhận" },
  { status: "PROCESSING", label: "Đang chuẩn bị hàng" },
  { status: "SHIPPED", label: "Đang vận chuyển" },
  { status: "DELIVERED", label: "Đã giao hàng" },
];
const rank: Record<string, number> = { NEW: 0, PENDING_PAYMENT: 0, PAID: 1, PROCESSING: 2, SHIPPED: 3, DELIVERED: 4, CANCELLED: -1 };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await commerceRepository.getOrder(id);
  if (!order) notFound();
  const canCancel = order.status === "NEW" || order.status === "PENDING_PAYMENT";
  const currentRank = rank[order.status];
  return (
    <>
      <PageHeader title={`Đơn hàng ${order.code}`} description={`Đặt lúc ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(new Date(order.createdAt))}`} action={<div className="flex flex-wrap gap-2"><StatusBadge status={order.status} />{canCancel ? <ConfirmDialog triggerLabel="Hủy đơn hàng" title="Bạn muốn hủy đơn hàng?" description="Bạn chỉ có thể hủy đơn mới tạo hoặc đang chờ thanh toán. Thao tác này không thể hoàn tác." confirmLabel="Xác nhận hủy" destructive /> : null}</div>} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_350px] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Trạng thái đơn hàng</h2><ol className="mt-6 grid gap-0 sm:grid-cols-5">{stages.map((stage, index) => { const done = currentRank >= index && order.status !== "CANCELLED"; return <li key={stage.status} className="relative flex gap-3 pb-5 sm:block sm:pb-0 sm:text-center"><span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{done ? <Check className="size-4" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}</span>{index < stages.length - 1 ? <span className={`absolute left-4 top-8 h-[calc(100%-32px)] w-px sm:left-1/2 sm:top-4 sm:h-px sm:w-full ${currentRank > index ? "bg-primary" : "bg-border"}`} aria-hidden="true" /> : null}<p className="pt-1 text-sm font-medium sm:mt-3 sm:pt-0">{stage.label}</p></li>; })}</ol>{order.status === "CANCELLED" ? <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">Đơn hàng đã bị hủy.</p> : null}</section>
          <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Sản phẩm</h2><div className="mt-4 divide-y">{order.items.map((item) => <div key={item.id} className="flex gap-4 py-4"><div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"><Image src={item.image} alt={item.productName} fill sizes="80px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{item.productName}</p><p className="mt-1 text-sm text-muted-foreground">{item.variant}</p><p className="mt-2 text-sm">{formatVnd(item.unitPrice)} x {item.quantity}</p></div><p className="hidden font-semibold sm:block">{formatVnd(item.unitPrice * item.quantity)}</p></div>)}</div></section>
          <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><MapPin className="size-5 text-primary" aria-hidden="true" /><h2 className="font-semibold">Địa chỉ giao hàng</h2></div><p className="mt-4 font-medium">{order.recipientName}</p><p className="mt-1 text-sm text-muted-foreground">{order.phoneNumber}</p><p className="mt-3 text-sm leading-6">{order.shippingAddress}</p></section><section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><Truck className="size-5 text-primary" aria-hidden="true" /><h2 className="font-semibold">Vận chuyển</h2></div><p className="mt-4 text-sm font-medium">{order.shippingMethod}</p><p className="mt-2 text-sm text-muted-foreground">Mã vận đơn: {order.trackingCode ?? "Chưa có"}</p></section></div>
          <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" aria-hidden="true" /><h2 className="font-semibold">Thanh toán</h2></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Phương thức:</span> PayOS</p><p><span className="text-muted-foreground">Trạng thái:</span> {order.paymentStatus}</p></div></section>
        </div>
        <div className="lg:sticky lg:top-28"><OrderSummary subtotal={order.subtotal} shippingFee={order.shippingFee} discount={order.discount} total={order.total} /><div className="mt-4 flex gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground"><Package className="size-5 shrink-0 text-primary" aria-hidden="true" /><p>Mọi yêu cầu xem hoặc cập nhật đơn hàng đều được hệ thống xác minh quyền sở hữu.</p></div></div>
      </div>
    </>
  );
}
