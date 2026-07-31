import type { Metadata } from "next";
import { AdminResourcePage } from "@/components/admin/admin-resource-page";
export const metadata: Metadata = { title: "Quản lý đánh giá" };
export default function AdminReviewsPage() { return <AdminResourcePage resource="reviews" resourceLabel="Đánh giá" title="Đánh giá" description="Kiểm duyệt đánh giá và theo dõi phản hồi về sản phẩm." />; }
