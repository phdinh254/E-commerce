import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý danh mục" };
export default function AdminCategoriesPage() { return <AdminResourcePage resource="categories" resourceLabel="Danh mục" title="Danh mục" description="Sắp xếp danh mục, thứ tự hiển thị và trạng thái hoạt động." createHref="/admin/categories#new" />; }
