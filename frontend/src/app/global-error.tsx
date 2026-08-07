"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
        <main className="max-w-md text-center">
          <p className="text-sm font-semibold text-primary">SEN</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Hệ thống đang gián đoạn</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Chúng tôi chưa thể hoàn tất yêu cầu. Vui lòng thử tải lại trang.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tải lại
          </button>
        </main>
      </body>
    </html>
  );
}
