"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

/**
 * The backend never puts tokens in this URL — it only sets the refresh
 * cookie and redirects here. Session restoration is `AuthProvider`'s own
 * mount-time silent refresh (it fires once per page load); this panel just
 * waits on that same `status` instead of calling `/auth/refresh` a second
 * time, which would race the first call and get rejected by rotation.
 */
export function GoogleCallbackPanel() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/account");
    }
  }, [status, router]);

  if (status === "unauthenticated") {
    return (
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-0.045em]">Không thể đăng nhập bằng Google</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Đăng nhập bằng Google không thành công hoặc đã bị hủy. Vui lòng thử lại.
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Đang hoàn tất đăng nhập...</h1>
      <p className="mt-3 leading-7 text-muted-foreground">Vui lòng đợi trong giây lát.</p>
    </div>
  );
}
