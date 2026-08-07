"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChartNoAxesCombined, ChevronDown, ClipboardList, FolderTree, LayoutDashboard, Menu, MessageSquareText, PackageSearch, ShieldCheck, ShoppingBag, Tags, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SenLogo } from "@/components/layout/sen-logo";

const navItems = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/products", label: "Sản phẩm", icon: ShoppingBag },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/brands", label: "Thương hiệu", icon: Tags },
  { href: "/admin/inventory", label: "Tồn kho", icon: Boxes },
  { href: "/admin/orders", label: "Đơn hàng", icon: ClipboardList },
  { href: "/admin/customers", label: "Khách hàng", icon: Users },
  { href: "/admin/reviews", label: "Đánh giá", icon: MessageSquareText },
  { href: "/admin/reports", label: "Báo cáo", icon: ChartNoAxesCombined },
  { href: "/admin/audit-log", label: "Nhật ký", icon: ShieldCheck },
];

function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav className="grid gap-1" aria-label="Quản trị">{navItems.map(({ href, label, icon: Icon }) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground", mobile && "min-h-11")}><Icon className="size-[18px]" aria-hidden="true" />{label}</Link>; })}</nav>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-muted/35 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] border-r bg-sidebar p-4 lg:flex lg:flex-col"><Link href="/admin" className="flex items-center gap-2 rounded-xl px-2 py-3"><SenLogo size={36} className="bg-sidebar-primary-foreground/10 rounded-xl p-1" /><div><p className="font-semibold">Quản trị SEN</p><p className="text-xs text-muted-foreground">Trung tâm vận hành</p></div></Link><div className="mt-5 flex-1 overflow-y-auto"><AdminNavigation /></div><Link href="/" className="mt-4 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><PackageSearch className="size-[18px]" aria-hidden="true" />Xem cửa hàng</Link></aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8"><Sheet><SheetTrigger aria-label="Mở điều hướng quản trị" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "lg:hidden")}><Menu aria-hidden="true" /></SheetTrigger><SheetContent side="left" className="w-[min(88vw,340px)]"><SheetHeader><SheetTitle>Quản trị SEN</SheetTitle><SheetDescription>Điều hướng khu vực vận hành.</SheetDescription></SheetHeader><div className="px-4"><AdminNavigation mobile /></div></SheetContent></Sheet><div className="min-w-0"><p className="truncate text-sm font-semibold">Khu vực quản trị</p><p className="hidden text-xs text-muted-foreground sm:block">Dữ liệu vận hành và đơn hàng</p></div><div className="ml-auto flex items-center gap-1"><ThemeToggle /><DropdownMenu><DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "gap-2")}><span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold">NA</span><span className="hidden sm:block">Ngọc Anh</span><ChevronDown className="size-3.5" aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>admin@example.com</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem>Hồ sơ quản trị</DropdownMenuItem><DropdownMenuItem>Cài đặt</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem render={<Link href="/" />}>Về cửa hàng</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
