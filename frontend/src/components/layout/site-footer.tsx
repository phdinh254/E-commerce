import Link from "next/link";
import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/forms/newsletter-form";

const promises = [
  { icon: Truck, title: "Giao h?ng to?n qu?c", text: "Theo d?i r? t?ng ch?ng" },
  { icon: RotateCcw, title: "??i tr? 30 ng?y", text: "Quy tr?nh minh b?ch" },
  { icon: ShieldCheck, title: "Thanh to?n an to?n", text: "X?c nh?n qua PayOS" },
  { icon: Headphones, title: "H? tr? t?n t?m", text: "Ph?n h?i trong gi? l?m vi?c" },
];

export function ServicePromises() {
  return (
    <div className="grid border-y sm:grid-cols-2 lg:grid-cols-4">
      {promises.map(({ icon: Icon, title, text }, index) => (
        <div key={title} className={`flex gap-3 px-4 py-5 sm:px-6 ${index > 0 ? "lg:border-l" : ""}`}>
          <Icon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>
        </div>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <p className="text-xl font-semibold tracking-[-0.03em]">Cobalt Market</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Ch?n l?c thi?t b? c?ng ngh? v? ?? d?ng hi?n ??i, ch? tr?ng tr?i nghi?m s? d?ng l?u d?i.</p>
            <div className="mt-6"><p className="mb-2 text-sm font-medium">Nh?n tin s?n ph?m m?i</p><NewsletterForm /></div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div><p className="text-sm font-semibold">Mua s?m</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/products">T?t c? s?n ph?m</Link><Link href="/search">T?m ki?m</Link><Link href="/cart">Gi? h?ng</Link></div></div>
            <div><p className="text-sm font-semibold">T?i kho?n</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/login">??ng nh?p</Link><Link href="/account/orders">??n h?ng</Link><Link href="/account/addresses">S? ??a ch?</Link></div></div>
            <div><p className="text-sm font-semibold">Th?ng tin</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/products">Ch?nh s?ch ??i tr?</Link><Link href="/products">Ch?nh s?ch b?o m?t</Link><Link href="/admin">Qu?n tr?</Link></div></div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between"><p>? 2026 Cobalt Market. B?n quy?n ???c b?o l?u.</p><p>Gi? hi?n th? ?? bao g?m thu? theo quy ??nh.</p></div>
      </Container>
    </footer>
  );
}
