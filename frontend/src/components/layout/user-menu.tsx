"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function UserMenu() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  if (status === "loading") {
    return <div className="hidden size-9 animate-pulse rounded-full bg-muted sm:block" aria-hidden="true" />;
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="hidden items-center gap-1 sm:flex">
        <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Đăng nhập</Link>
        <Link href="/register" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>Đăng ký</Link>
      </div>
    );
  }

  async function handleLogout() {
    const { serverRevoked } = await logout();
    if (!serverRevoked) {
      toast.error("Đã đăng xuất trên trình duyệt này, nhưng không thể xác nhận với máy chủ. Vui lòng kiểm tra kết nối.");
    } else {
      toast.success("Đã đăng xuất.");
    }
    router.push("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tài khoản của ${user.fullName}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "hidden rounded-full sm:inline-flex")}
      >
        <Avatar size="sm">
          <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-semibold">{user.fullName}</span>
          <span className="font-normal text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound aria-hidden="true" />
          Tài khoản của tôi
        </DropdownMenuItem>
        {user.role === "ADMIN" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>Khu vực quản trị</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut aria-hidden="true" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
