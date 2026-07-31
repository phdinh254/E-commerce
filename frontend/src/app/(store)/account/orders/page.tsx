import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/commerce/status-badge";
import { formatVnd } from "@/components/commerce/price-display";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Đơn hàng của tôi" };
const filters = [{ value: "all", label: "Tất cả" }, { value: "PENDING_PAYMENT", label: "Chờ thanh toán" }, { value: "SHIPPED", label: "Đang giao" }, { value: "DELIVERED", label: "Đã giao" }, { value: "CANCELLED", label: "Đã hủy" }];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const orders = (await commerceRepository.getOrders()).filter((order) => status === "all" || order.status === status);
  return <><PageHeader title="Đơn hàng của tôi" description="Theo dõi trạng thái thanh toán, xử lý, vận chuyển và lịch sử mua hàng." /><nav className="mt-6 flex gap-2 overflow-x-auto border-b pb-3" aria-label="Lọc trạng thái đơn hàng">{filters.map((filter) => <Link key={filter.value} href={filter.value === "all" ? "/account/orders" : `/account/orders?status=${filter.value}`} className={cn("min-w-max rounded-lg px-3 py-2 text-sm font-medium", status === filter.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{filter.label}</Link>)}</nav><div className="mt-6 space-y-4">{orders.map((order) => <article key={order.id} className="rounded-2xl border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5"><div><p className="font-semibold">{order.code}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</p></div><StatusBadge status={order.status} /></div><div className="p-4 sm:p-5">{order.items.slice(0, 2).map((item) => <div key={item.id} className="flex gap-3 py-2"><div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted"><Image src={item.image} alt={item.productName} fill sizes="64px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="line-clamp-1 font-medium">{item.productName}</p><p className="mt-1 text-sm text-muted-foreground">{item.variant} / Số lượng {item.quantity}</p></div><p className="hidden text-sm font-medium sm:block">{formatVnd(item.unitPrice * item.quantity)}</p></div>)}</div><div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-sm">Tổng cộng <span className="ml-2 text-lg font-semibold">{formatVnd(order.total)}</span></p><Link href={`/account/orders/${order.id}`} className={cn(buttonVariants({ variant: "outline" }))}>Xem chi tiết</Link></div></article>)}</div></>;
}
