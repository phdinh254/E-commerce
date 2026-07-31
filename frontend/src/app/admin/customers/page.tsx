import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? kh?ch h?ng" };
export default function AdminCustomersPage() { return <AdminResourcePage resource="customers" resourceLabel="Kh?ch h?ng" title="Kh?ch h?ng" description="Xem h? s?, tr?ng th?i t?i kho?n v? l?ch s? mua h?ng." canDelete={false} />; }
