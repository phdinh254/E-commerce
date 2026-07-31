import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? danh m?c" };
export default function AdminCategoriesPage() { return <AdminResourcePage resource="categories" resourceLabel="Danh m?c" title="Danh m?c" description="T? ch?c c?y danh m?c, th? t? hi?n th? v? tr?ng th?i ho?t ??ng." createHref="/admin/categories#new" />; }
