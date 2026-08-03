"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/container";
import { AccountNav } from "@/components/commerce/account-nav";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { useAuth } from "@/lib/auth/auth-provider";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent("/account")}`);
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <Container className="py-8 sm:py-10 lg:py-12">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10 lg:py-12">
      <Breadcrumbs items={[{ label: "Tài khoản" }]} />
      <div className="mt-7 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="mb-5 hidden lg:block">
            <p className="font-semibold">{user.fullName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
