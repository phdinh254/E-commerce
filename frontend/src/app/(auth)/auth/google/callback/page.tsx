import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleCallbackPanel } from "@/components/forms/google-callback-panel";

export const metadata: Metadata = { title: "Đang đăng nhập với Google" };

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackPanel />
    </Suspense>
  );
}
