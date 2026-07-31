import { Separator } from "@/components/ui/separator";
import { formatVnd } from "@/components/commerce/price-display";

export function OrderSummary({ subtotal, shippingFee, discount = 0, total, action }: { subtotal: number; shippingFee: number; discount?: number; total: number; action?: React.ReactNode }) {
  return (
    <aside className="rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="text-lg font-semibold">Tóm tắt đơn hàng</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tạm tính</dt><dd className="font-medium">{formatVnd(subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Phí vận chuyển</dt><dd className="font-medium">{shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)}</dd></div>
        {discount > 0 ? <div className="flex justify-between gap-4 text-success"><dt>Giảm giá</dt><dd className="font-medium">-{formatVnd(discount)}</dd></div> : null}
      </dl>
      <Separator className="my-5" />
      <div className="flex items-end justify-between gap-4"><p className="font-semibold">Tổng cộng</p><p className="text-xl font-bold tracking-[-0.03em]">{formatVnd(total)}</p></div>
      <p className="mt-1 text-right text-xs text-muted-foreground">Đã bao gồm thuế</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </aside>
  );
}
