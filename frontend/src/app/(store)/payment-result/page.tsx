import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kết quả thanh toán" };

const states = {
  success: { icon: CheckCircle2, tone: "text-success bg-success/12", title: "Thanh toán đã được xác nhận", description: "Hệ thống đã nhận xác nhận hợp lệ từ PayOS và cập nhật trạng thái đơn hàng.", action: "Xem chi tiết đơn hàng" },
  failed: { icon: XCircle, tone: "text-destructive bg-destructive/10", title: "Thanh toán chưa thành công", description: "Giao dịch chưa hoàn tất. Bạn có thể thử thanh toán lại từ trang chi tiết đơn hàng.", action: "Thử thanh toán lại" },
  cancelled: { icon: RotateCcw, tone: "text-warning-foreground bg-warning/16 dark:text-warning", title: "Bạn đã hủy thanh toán", description: "Đơn hàng vẫn được giữ ở trạng thái chờ thanh toán trong thời gian quy định.", action: "Quay lại đơn hàng" },
  pending: { icon: Clock3, tone: "text-primary bg-accent", title: "Đang chờ xác nhận thanh toán", description: "Hệ thống đang đối chiếu kết quả với PayOS. Trạng thái sẽ được cập nhật ngay khi thanh toán được xác nhận.", action: "Kiểm tra đơn hàng" },
};

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ status?: string; order?: string }> }) {
  const { status = "pending", order = "CM24073101" } = await searchParams;
  const state = states[status as keyof typeof states] ?? states.pending;
  const Icon = state.icon;
  return (
    <Container className="grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 text-center shadow-soft sm:p-10">
        <span className={cn("mx-auto grid size-14 place-items-center rounded-2xl", state.tone)}><Icon className="size-7" aria-hidden="true" /></span>
        <p className="mt-6 text-sm font-medium text-muted-foreground">Đơn hàng {order}</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em]">{state.title}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">{state.description}</p>
        {status === "pending" ? <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm leading-6"><p className="font-semibold">Giao dịch chưa được đánh dấu là thành công.</p><p className="mt-1 text-muted-foreground">Hệ thống sẽ tự động kiểm tra lại trạng thái đơn hàng sau ít phút.</p></div> : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/account/orders/order-1" className={cn(buttonVariants({ size: "lg" }))}>{state.action}</Link><Link href="/products" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Tiếp tục mua sắm</Link></div>
      </div>
    </Container>
  );
}
