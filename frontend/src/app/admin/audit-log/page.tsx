import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Nh?t k? h? th?ng" };
export default function AdminAuditPage() { return <AdminResourcePage resource="audit" resourceLabel="Nh?t k?" title="Nh?t k? h? th?ng" description="UI ???c chu?n b?, nh?ng backend hi?n ch?a h? tr? audit log n?n d? li?u ?ang l? mock." canDelete={false} />; }
