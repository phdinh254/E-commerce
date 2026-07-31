import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "K?t qu? thanh to?n" };

const states = {
  success: { icon: CheckCircle2, tone: "text-success bg-success/12", title: "Thanh to?n ?? ???c x?c nh?n", description: "Backend ?? nh?n webhook h?p l? t? PayOS v? c?p nh?t tr?ng th?i ??n h?ng.", action: "Xem chi ti?t ??n h?ng" },
  failed: { icon: XCircle, tone: "text-destructive bg-destructive/10", title: "Thanh to?n ch?a th?nh c?ng", description: "Giao d?ch kh?ng ho?n t?t. B?n c? th? th? thanh to?n l?i t? trang ??n h?ng.", action: "Th? thanh to?n l?i" },
  cancelled: { icon: RotateCcw, tone: "text-warning-foreground bg-warning/16 dark:text-warning", title: "B?n ?? h?y thanh to?n", description: "??n h?ng v?n ???c gi? ? tr?ng th?i ch? thanh to?n trong th?i gian quy ??nh.", action: "Quay l?i ??n h?ng" },
  pending: { icon: Clock3, tone: "text-primary bg-accent", title: "?ang ch? x?c nh?n thanh to?n", description: "Vi?c quay v? t? PayOS ch?a ph?i b?ng ch?ng thanh to?n. H? th?ng ?ang ch? backend x?c nh?n webhook.", action: "Ki?m tra ??n h?ng" },
};

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ status?: string; order?: string }> }) {
  const { status = "pending", order = "CM24073101" } = await searchParams;
  const state = states[status as keyof typeof states] ?? states.pending;
  const Icon = state.icon;
  return (
    <Container className="grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 text-center shadow-soft sm:p-10">
        <span className={cn("mx-auto grid size-14 place-items-center rounded-2xl", state.tone)}><Icon className="size-7" aria-hidden="true" /></span>
        <p className="mt-6 text-sm font-medium text-muted-foreground">??n h?ng {order}</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em]">{state.title}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">{state.description}</p>
        {status === "pending" ? <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm leading-6"><p className="font-semibold">Trang s? kh?ng t? ??nh d?u th?nh c?ng.</p><p className="mt-1 text-muted-foreground">Khi k?t n?i API ??n h?ng, frontend s? truy v?n l?i tr?ng th?i do backend cung c?p.</p></div> : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/account/orders/order-1" className={cn(buttonVariants({ size: "lg" }))}>{state.action}</Link><Link href="/products" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Ti?p t?c mua s?m</Link></div>
      </div>
    </Container>
  );
}
