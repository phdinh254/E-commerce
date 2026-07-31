import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? th??ng hi?u" };
export default function AdminBrandsPage() { return <AdminResourcePage resource="brands" resourceLabel="Th??ng hi?u" title="Th??ng hi?u" description="Qu?n l? th??ng hi?u v? li?n k?t t?i danh m?c s?n ph?m." createHref="/admin/brands#new" />; }
