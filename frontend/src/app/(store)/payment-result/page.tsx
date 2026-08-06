import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResultPanel } from "@/components/commerce/payment-result-panel";

export const metadata: Metadata = { title: "Kết quả thanh toán" };

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResultPanel />
    </Suspense>
  );
}
