"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePaymentStatus } from "@/lib/hooks/use-payment-status";
import { useSyncPaymentStatus } from "@/lib/hooks/use-sync-payment-status";
import type { PaymentStatus } from "@/types/payment";

const STATE_BY_PAYMENT_STATUS: Record<
  PaymentStatus,
  { icon: typeof CheckCircle2; tone: string; title: string; description: string }
> = {
  PAID: {
    icon: CheckCircle2,
    tone: "text-success bg-success/12",
    title: "Thanh toán đã được xác nhận",
    description: "Hệ thống đã nhận xác nhận hợp lệ và cập nhật trạng thái đơn hàng.",
  },
  FAILED: {
    icon: XCircle,
    tone: "text-destructive bg-destructive/10",
    title: "Thanh toán chưa thành công",
    description: "Giao dịch chưa hoàn tất. Bạn có thể thử thanh toán lại từ trang chi tiết đơn hàng.",
  },
  CANCELLED: {
    icon: RotateCcw,
    tone: "text-warning-foreground bg-warning/16 dark:text-warning",
    title: "Bạn đã hủy thanh toán",
    description: "Đơn hàng vẫn được giữ lại. Bạn có thể thử thanh toán lại từ trang chi tiết đơn hàng.",
  },
  EXPIRED: {
    icon: XCircle,
    tone: "text-destructive bg-destructive/10",
    title: "Liên kết thanh toán đã hết hạn",
    description: "Vui lòng thử thanh toán lại từ trang chi tiết đơn hàng.",
  },
  PENDING: {
    icon: Clock3,
    tone: "text-primary bg-accent",
    title: "Đang chờ xác nhận thanh toán",
    description: "Hệ thống đang đối chiếu kết quả với PayOS. Trạng thái sẽ được cập nhật ngay khi thanh toán được xác nhận.",
  },
};

/**
 * Ch17-B173: the identifier in the URL (`orderId`) is only a POINTER used
 * to ask the backend for the real status — `usePaymentStatus` is the ONLY
 * source of truth rendered here. Any `status`/`code` PayOS appends to the
 * return URL is deliberately never read; a user could edit those params
 * freely and it must change nothing.
 */
export function PaymentResultPanel() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { data, isLoading, isError, error, refetch } = usePaymentStatus(orderId);
  const syncMutation = useSyncPaymentStatus(orderId);

  if (!orderId) {
    return (
      <ResultShell>
        <p className="text-sm font-medium text-muted-foreground">Liên kết không hợp lệ</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em]">
          Không tìm thấy thông tin đơn hàng
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
          Đường dẫn này thiếu mã đơn hàng. Vui lòng quay lại trang đơn hàng của bạn.
        </p>
        <Actions />
      </ResultShell>
    );
  }

  if (isLoading) {
    return (
      <ResultShell>
        <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Đang tải trạng thái thanh toán...</p>
      </ResultShell>
    );
  }

  if (isError || !data) {
    return (
      <ResultShell>
        <p className="text-sm font-medium text-destructive">Không thể tải trạng thái thanh toán</p>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
          {error instanceof Error ? error.message : "Đã xảy ra lỗi. Vui lòng thử lại."}
        </p>
        <div className="mt-6">
          <Button onClick={() => refetch()}>Thử lại</Button>
        </div>
      </ResultShell>
    );
  }

  const state = STATE_BY_PAYMENT_STATUS[data.paymentStatus];
  const Icon = state.icon;

  return (
    <ResultShell>
      <span className={cn("mx-auto grid size-14 place-items-center rounded-2xl", state.tone)}>
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm font-medium text-muted-foreground">Đơn hàng #{data.orderId.slice(0, 8)}</p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em]">{state.title}</h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">{state.description}</p>

      {data.paymentStatus === "PENDING" ? (
        <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm leading-6">
          <p className="font-semibold">Giao dịch chưa được đánh dấu là thành công.</p>
          <p className="mt-1 text-muted-foreground">Hệ thống sẽ tự động kiểm tra lại trạng thái đơn hàng sau ít phút.</p>
          {data.paymentMethod === "PAYOS" ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate(data.paymentId)}
            >
              {syncMutation.isPending ? "Đang kiểm tra..." : "Kiểm tra lại ngay"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Actions orderId={data.orderId} />
    </ResultShell>
  );
}

function ResultShell({ children }: { children: React.ReactNode }) {
  return (
    <Container className="grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 text-center shadow-soft sm:p-10">{children}</div>
    </Container>
  );
}

function Actions({ orderId }: { orderId?: string }) {
  return (
    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      <Link
        href={orderId ? `/account/orders/${orderId}` : "/account/orders"}
        className={cn(buttonVariants({ size: "lg" }))}
      >
        Xem chi tiết đơn hàng
      </Link>
      <Link href="/products" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
        Tiếp tục mua sắm
      </Link>
    </div>
  );
}
