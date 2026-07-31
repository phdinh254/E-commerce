import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Nhật ký hệ thống" };
export default function AdminAuditPage() { return <AdminResourcePage resource="audit" resourceLabel="Nhật ký" title="Nhật ký hệ thống" description="Theo dõi các thao tác quản trị và thay đổi quan trọng trong hệ thống." canDelete={false} />; }
