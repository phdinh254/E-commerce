import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailPanel } from "@/components/forms/verify-email-panel";

export const metadata: Metadata = { title: "Xác minh tài khoản" };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPanel />
    </Suspense>
  );
}
