"use client";

import Link from "next/link";
import { Menu, ShoppingBag, UserRound } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SearchBox } from "@/components/commerce/search-box";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/products", label: "S?n ph?m" },
  { href: "/products?category=am-thanh", label: "?m thanh" },
  { href: "/products?category=khong-gian-lam-viec", label: "G?c l?m vi?c" },
  { href: "/account/orders", label: "??n h?ng" },
];

function BrandMark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="Cobalt Market, v? trang ch?">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-soft" aria-hidden="true">C</span>
      <span className="hidden text-base font-semibold tracking-[-0.02em] sm:block">Cobalt Market</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <>
      <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
        Mi?n ph? giao h?ng cho ??n t? 1.000.000 ?. ??i tr? trong 30 ng?y.
      </div>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <Container className="flex h-16 items-center gap-3 lg:h-[72px]">
          <BrandMark />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="?i?u h??ng ch?nh">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
          <SearchBox compact className="mx-auto hidden max-w-md xl:flex" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/account" aria-label="T?i kho?n" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "hidden sm:inline-flex")}><UserRound aria-hidden="true" /></Link>
            <Link href="/cart" aria-label="Gi? h?ng, 2 s?n ph?m" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative")}>
              <ShoppingBag aria-hidden="true" />
              <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
            </Link>
            <Sheet>
              <SheetTrigger aria-label="M? menu" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "lg:hidden")}><Menu aria-hidden="true" /></SheetTrigger>
              <SheetContent side="right" className="w-[min(88vw,380px)]">
                <SheetHeader>
                  <SheetTitle>Danh m?c</SheetTitle>
                  <SheetDescription>T?m nhanh s?n ph?m v? khu v?c t?i kho?n.</SheetDescription>
                </SheetHeader>
                <div className="px-4"><SearchBox /></div>
                <nav className="grid gap-1 px-4" aria-label="?i?u h??ng di ??ng">
                  {navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">{item.label}</Link>)}
                  <Link href="/account" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">T?i kho?n</Link>
                  <Link href="/admin" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">Khu v?c qu?n tr?</Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </Container>
        <Container className="pb-3 xl:hidden"><SearchBox compact /></Container>
      </header>
    </>
  );
}
