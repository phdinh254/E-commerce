import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý sản phẩm" };
export default function AdminProductsPage() { return <AdminResourcePage resource="products" resourceLabel="Sản phẩm" title="Sản phẩm" description="Quản lý thông tin bán hàng, hiển thị và trạng thái sản phẩm." createHref="/admin/products/new" detailBase="/admin/products" />; }
