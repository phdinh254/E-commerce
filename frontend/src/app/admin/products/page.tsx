import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? s?n ph?m" };
export default function AdminProductsPage() { return <AdminResourcePage resource="products" resourceLabel="S?n ph?m" title="S?n ph?m" description="Qu?n l? th?ng tin b?n h?ng, hi?n th? v? tr?ng th?i s?n ph?m." createHref="/admin/products/new" detailBase="/admin/products" />; }
