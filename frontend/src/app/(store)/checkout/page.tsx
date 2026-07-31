import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutForm } from "@/components/forms/checkout-form";

export const metadata: Metadata = { title: "Thanh to?n" };
export default function CheckoutPage() { return <Container className="py-8 sm:py-10 lg:py-12"><Breadcrumbs items={[{ label: "Gi? h?ng", href: "/cart" }, { label: "Thanh to?n" }]} /><PageHeader title="Thanh to?n" description="Ho?n t?t th?ng tin giao h?ng v? ki?m tra t?ng ti?n tr??c khi chuy?n t?i PayOS." className="mt-6" /><div className="mt-8"><CheckoutForm /></div></Container>; }
