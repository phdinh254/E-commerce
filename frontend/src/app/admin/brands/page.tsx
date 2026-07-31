import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý thương hiệu" };
export default function AdminBrandsPage() { return <AdminResourcePage resource="brands" resourceLabel="Thương hiệu" title="Thương hiệu" description="Quản lý thương hiệu và các danh mục sản phẩm liên quan." createHref="/admin/brands#new" />; }
