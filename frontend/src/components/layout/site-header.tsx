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
  { href: "/products", label: "Sản phẩm" },
  { href: "/products?category=am-thanh", label: "Âm thanh" },
  { href: "/products?category=khong-gian-lam-viec", label: "Góc làm việc" },
  { href: "/account/orders", label: "Đơn hàng" },
];

function BrandMark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="Cobalt Market, về trang chủ">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-soft" aria-hidden="true">C</span>
      <span className="hidden text-base font-semibold tracking-[-0.02em] sm:block">Cobalt Market</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <>
      <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
        Miễn phí giao hàng cho đơn từ 1.000.000 đ. Đổi trả trong 30 ngày.
      </div>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <Container className="flex h-16 items-center gap-3 lg:h-[72px]">
          <BrandMark />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
          <SearchBox compact className="mx-auto hidden max-w-md xl:flex" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/account" aria-label="Tài khoản" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "hidden sm:inline-flex")}><UserRound aria-hidden="true" /></Link>
            <Link href="/cart" aria-label="Giỏ hàng, 2 sản phẩm" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative")}>
              <ShoppingBag aria-hidden="true" />
              <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
            </Link>
            <Sheet>
              <SheetTrigger aria-label="Mở menu" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "lg:hidden")}><Menu aria-hidden="true" /></SheetTrigger>
              <SheetContent side="right" className="w-[min(88vw,380px)]">
                <SheetHeader>
                  <SheetTitle>Danh mục</SheetTitle>
                  <SheetDescription>Tìm nhanh sản phẩm và khu vực tài khoản.</SheetDescription>
                </SheetHeader>
                <div className="px-4"><SearchBox /></div>
                <nav className="grid gap-1 px-4" aria-label="Điều hướng di động">
                  {navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">{item.label}</Link>)}
                  <Link href="/account" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">Tài khoản</Link>
                  <Link href="/admin" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">Khu vực quản trị</Link>
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
