import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? ??n h?ng" };
export default function AdminOrdersPage() { return <AdminResourcePage resource="orders" resourceLabel="??n h?ng" title="??n h?ng" description="Theo d?i thanh to?n, x? l? v? v?n chuy?n theo tr?ng th?i." detailBase="/admin/orders" canDelete={false} />; }
