import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý tồn kho" };
export default function AdminInventoryPage() { return <AdminResourcePage resource="inventory" resourceLabel="Tồn kho" title="Tồn kho" description="Theo dõi lượng hàng khả dụng và cảnh báo sản phẩm cần nhập thêm." canDelete={false} />; }
