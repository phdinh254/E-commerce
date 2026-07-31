import { Container } from "@/components/layout/container";
import { AccountNav } from "@/components/commerce/account-nav";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <Container className="py-8 sm:py-10 lg:py-12"><Breadcrumbs items={[{ label: "T?i kho?n" }]} /><div className="mt-7 grid gap-8 lg:grid-cols-[240px_1fr]"><aside><div className="mb-5 hidden lg:block"><p className="font-semibold">Nguy?n Minh Anh</p><p className="mt-1 text-sm text-muted-foreground">minhanh@example.com</p></div><AccountNav /></aside><div className="min-w-0">{children}</div></div></Container>;
}
