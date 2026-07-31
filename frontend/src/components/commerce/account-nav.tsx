"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, MapPin, Package, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/account", label: "Thông tin cá nhân", icon: UserRound },
  { href: "/account/addresses", label: "Sổ địa chỉ", icon: MapPin },
  { href: "/account/orders", label: "Đơn hàng của tôi", icon: Package },
  { href: "/account#password", label: "Mật khẩu", icon: KeyRound },
];

export function AccountNav() {
  const pathname = usePathname();
  return <nav className="flex gap-2 overflow-x-auto lg:grid" aria-label="Tài khoản">{items.map(({ href, label, icon: Icon }) => { const active = href === "/account" ? pathname === "/account" : pathname.startsWith(href.split("#")[0]); return <Link key={href} href={href} className={cn("flex min-h-11 min-w-max items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</Link>; })}</nav>;
}
