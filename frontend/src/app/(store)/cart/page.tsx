import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { CartContent } from "@/components/commerce/cart-content";

export const metadata: Metadata = { title: "Giỏ hàng" };
export default function CartPage() { return <Container className="py-8 sm:py-10 lg:py-12"><Breadcrumbs items={[{ label: "Giỏ hàng" }]} /><PageHeader title="Giỏ hàng của bạn" description="Kiểm tra sản phẩm, phiên bản và số lượng trước khi thanh toán." className="mt-6" /><div className="mt-8"><CartContent /></div></Container>; }
