import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { CartContent } from "@/components/commerce/cart-content";

export const metadata: Metadata = { title: "Gi? h?ng" };
export default function CartPage() { return <Container className="py-8 sm:py-10 lg:py-12"><Breadcrumbs items={[{ label: "Gi? h?ng" }]} /><PageHeader title="Gi? h?ng c?a b?n" description="Ki?m tra s?n ph?m, bi?n th? v? s? l??ng tr??c khi thanh to?n." className="mt-6" /><div className="mt-8"><CartContent /></div></Container>; }
