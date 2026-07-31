import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Boxes, CircleDollarSign, ShoppingCart, Users } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { StatusBadge } from "@/components/commerce/status-badge";
import { formatVnd } from "@/components/commerce/price-display";

export const metadata: Metadata = { title: "T?ng quan qu?n tr?" };
const metrics = [
  { label: "Doanh thu th?ng", value: "128,4 tri?u ?", change: "+8,2%", icon: CircleDollarSign },
  { label: "??n h?ng", value: "342", change: "+24 ??n", icon: ShoppingCart },
  { label: "Kh?ch h?ng m?i", value: "86", change: "+12,6%", icon: Users },
  { label: "S?n ph?m s?p h?t", value: "7", change: "C?n x? l?", icon: Boxes },
];

export default async function AdminDashboardPage() {
  const [orderRows, products] = await Promise.all([commerceRepository.getAdminRows("orders"), commerceRepository.getProducts()]);
  const lowStock = products.filter((product) => product.stock <= 7);
  return <div className="mx-auto max-w-[1400px]"><PageHeader title="T?ng quan" description="T?nh h?nh b?n h?ng v? c?c ??u vi?c v?n h?nh c?n ch? ?." /><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, change, icon: Icon }) => <article key={label} className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><Icon className="size-5" aria-hidden="true" /></span><span className="text-xs font-medium text-muted-foreground">{change}</span></div><p className="mt-6 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{value}</p></article>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"><section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">??n h?ng g?n ??y</h2><Link href="/admin/orders" className="flex items-center gap-1 text-sm font-medium text-primary">Xem t?t c?<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div><AdminDataTable data={orderRows} resource="??n h?ng" detailBase="/admin/orders" canDelete={false} /></section><section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">C?nh b?o t?n kho</h2><Link href="/admin/inventory" className="text-sm font-medium text-primary">Xem kho</Link></div><div className="rounded-2xl border bg-card p-4">{lowStock.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatVnd(product.price)}</p></div><StatusBadge status={product.stockStatus} /></div>)}</div></section></div></div>;
}
