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
        title="C? l?i x?y ra"
        description="Cobalt ch?a th? t?i n?i dung n?y. H?y ki?m tra k?t n?i r?i th? l?i."
        actionLabel="Th? l?i"
        onRetry={unstable_retry}
      />
    </main>
  );
}
