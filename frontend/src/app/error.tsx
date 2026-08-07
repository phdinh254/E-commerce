"use client";

import { useEffect } from "react";
import { StatePanel } from "@/components/feedback/state-panel";

export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-24 sm:px-6 lg:px-8">
      <StatePanel
        kind="error"
        title="Có lỗi xảy ra"
        description="SEN chưa thể tải nội dung này. Hãy kiểm tra kết nối rồi thử lại."
        actionLabel="Thử lại"
        onRetry={unstable_retry}
      />
    </main>
  );
}
