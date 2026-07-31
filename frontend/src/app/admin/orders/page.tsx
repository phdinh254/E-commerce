import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý đơn hàng" };
export default function AdminOrdersPage() { return <AdminResourcePage resource="orders" resourceLabel="Đơn hàng" title="Đơn hàng" description="Theo dõi thanh toán, xử lý và vận chuyển theo từng trạng thái." detailBase="/admin/orders" canDelete={false} />; }
