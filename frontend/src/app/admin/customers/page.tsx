import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý khách hàng" };
export default function AdminCustomersPage() { return <AdminResourcePage resource="customers" resourceLabel="Khách hàng" title="Khách hàng" description="Xem hồ sơ, trạng thái tài khoản và lịch sử mua hàng của khách." canDelete={false} />; }
