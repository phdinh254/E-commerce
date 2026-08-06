"use client";

import Link from "next/link";
import { CartItem } from "@/components/commerce/cart-item";
import { CouponInput } from "@/components/commerce/coupon-input";
import { OrderSummary } from "@/components/commerce/order-summary";
import { StatePanel } from "@/components/feedback/state-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { useUpdateCartItem } from "@/lib/hooks/use-update-cart-item";
import { useRemoveCartItem } from "@/lib/hooks/use-remove-cart-item";
import { useRemoveCoupon } from "@/lib/hooks/use-remove-coupon";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function CartContent() {
  const { status: authStatus } = useAuth();
  const cartQuery = useCart();
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const removeCouponMutation = useRemoveCoupon();

  if (authStatus === "loading") {
    return (
      <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <StatePanel
        kind="forbidden"
        title="Vui lòng đăng nhập"
        description="Giỏ hàng chỉ dành cho tài khoản đã đăng nhập."
        actionLabel="Đăng nhập"
        actionHref="/login?redirect=%2Fcart"
      />
    );
  }

  if (cartQuery.isLoading) {
    return (
      <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Đang tải giỏ hàng...
      </div>
    );
  }

  if (cartQuery.isError) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải giỏ hàng"
        description={getApiErrorMessage(cartQuery.error)}
        actionLabel="Thử lại"
        onRetry={() => void cartQuery.refetch()}
      />
    );
  }

  const cart = cartQuery.data;
  if (!cart || cart.items.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Giỏ hàng đang trống"
        description="Khám phá sản phẩm và thêm lựa chọn phù hợp vào giỏ hàng."
        actionLabel="Tiếp tục mua sắm"
        actionHref="/products"
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-3">
        {cart.items.map((item) => (
          <CartItem
            key={item.itemId}
            item={item}
            isUpdating={updateMutation.isPending && updateMutation.variables?.itemId === item.itemId}
            isRemoving={removeMutation.isPending && removeMutation.variables === item.itemId}
            onQuantityChange={(quantity) => updateMutation.mutate({ itemId: item.itemId, quantity })}
            onRemove={() => removeMutation.mutate(item.itemId)}
          />
        ))}
      </div>
      <div className="space-y-4 lg:sticky lg:top-28">
        {cart.couponRemovedReason ? (
          <p role="status" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {cart.couponRemovedReason}
          </p>
        ) : null}

        {cart.appliedCoupon ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{cart.appliedCoupon.code}</p>
              {cart.appliedCoupon.name ? (
                <p className="truncate text-xs text-muted-foreground">{cart.appliedCoupon.name}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removeCouponMutation.isPending}
              aria-label={`Gỡ mã giảm giá ${cart.appliedCoupon.code}`}
              onClick={() => removeCouponMutation.mutate()}
            >
              {removeCouponMutation.isPending ? "Đang gỡ..." : "Gỡ mã"}
            </Button>
          </div>
        ) : (
          <CouponInput disabled={cart.items.length === 0} />
        )}

        <OrderSummary
          subtotal={cart.subtotal}
          shippingFee={0}
          discount={cart.discountAmount}
          total={cart.total}
          action={
            <>
              <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                Tiến hành thanh toán
              </Link>
              <Link href="/products" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "mt-2 w-full")}>
                Tiếp tục mua sắm
              </Link>
            </>
          }
        />
      </div>
    </div>
  );
}
