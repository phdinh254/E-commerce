import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Qu?n l? ??nh gi?" };
export default function AdminReviewsPage() { return <AdminResourcePage resource="reviews" resourceLabel="??nh gi?" title="??nh gi?" description="Ki?m duy?t n?i dung ??nh gi? v? theo d?i ph?n h?i s?n ph?m." />; }
