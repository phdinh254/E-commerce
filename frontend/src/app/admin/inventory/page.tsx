import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? t?n kho" };
export default function AdminInventoryPage() { return <AdminResourcePage resource="inventory" resourceLabel="T?n kho" title="T?n kho" description="Theo d?i s? l??ng kh? d?ng v? c?nh b?o s?n ph?m c?n nh?p th?m." canDelete={false} />; }
