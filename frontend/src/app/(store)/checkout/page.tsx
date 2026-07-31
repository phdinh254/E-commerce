import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutForm } from "@/components/forms/checkout-form";

export const metadata: Metadata = { title: "Thanh toán" };
export default function CheckoutPage() { return <Container className="py-8 sm:py-10 lg:py-12"><Breadcrumbs items={[{ label: "Giỏ hàng", href: "/cart" }, { label: "Thanh toán" }]} /><PageHeader title="Thanh toán" description="Hoàn tất thông tin giao hàng và kiểm tra tổng tiền trước khi thanh toán qua PayOS." className="mt-6" /><div className="mt-8"><CheckoutForm /></div></Container>; }
