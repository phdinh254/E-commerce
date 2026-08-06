"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CreditCard, LockKeyhole, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OrderSummary } from "@/components/commerce/order-summary";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { usePlaceCodOrder } from "@/lib/hooks/use-place-cod-order";
import { usePlacePayOsOrder } from "@/lib/hooks/use-place-payos-order";
import { getApiErrorMessage } from "@/lib/api/client";
import type { CheckoutPayload } from "@/types/payment";

const checkoutSchema = z.object({
  shippingRecipientName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự."),
  shippingPhoneNumber: z.string().regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại chưa hợp lệ."),
  shippingProvince: z.string().min(2, "Vui lòng nhập tỉnh hoặc thành phố."),
  shippingDistrict: z.string().min(2, "Vui lòng nhập quận hoặc huyện."),
  shippingWard: z.string().min(2, "Vui lòng nhập phường hoặc xã."),
  shippingStreetAddress: z.string().min(5, "Vui lòng nhập địa chỉ chi tiết."),
  shippingNote: z.string().max(500, "Ghi chú không được vượt quá 500 ký tự.").optional(),
  paymentMethod: z.enum(["COD", "PAYOS"]),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

/**
 * Guest guard (UX layer only — the backend's JwtAuthGuard is the real
 * enforcement): redirects to login before any checkout API call ever
 * fires, mirroring AccountLayout's pattern. Never renders the form (which
 * would call useCart -> a real request) until auth status has resolved
 * past "loading".
 */
export function CheckoutForm() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent("/checkout")}`);
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
  }

  return <CheckoutFormAuthenticated />;
}

function CheckoutFormAuthenticated() {
  const router = useRouter();
  const { data: cart, isLoading: isCartLoading } = useCart();
  const placeCod = usePlaceCodOrder();
  const placePayOs = usePlacePayOsOrder();

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingRecipientName: "",
      shippingPhoneNumber: "",
      shippingProvince: "",
      shippingDistrict: "",
      shippingWard: "",
      shippingStreetAddress: "",
      shippingNote: "",
      paymentMethod: "PAYOS",
    },
  });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });

  const isEmpty = !isCartLoading && (!cart || cart.items.length === 0);
  const isSubmitting = placeCod.isPending || placePayOs.isPending;

  const submit = form.handleSubmit(async (values) => {
    const { paymentMethod: method, ...shipping } = values;
    const payload: CheckoutPayload = {
      ...shipping,
      shippingNote: shipping.shippingNote || undefined,
    };

    try {
      if (method === "COD") {
        const result = await placeCod.mutateAsync(payload);
        router.push(`/payment-result?orderId=${encodeURIComponent(result.orderId)}`);
        return;
      }

      const result = await placePayOs.mutateAsync(payload);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      // Defensive fallback — should not happen when the backend reports
      // success, but never leave the user stranded with no next step.
      router.push(`/payment-result?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_390px] lg:items-start" noValidate>
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Địa chỉ nhận hàng</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shippingRecipientName">Họ và tên</Label>
              <Input
                id="shippingRecipientName"
                autoComplete="name"
                aria-invalid={Boolean(form.formState.errors.shippingRecipientName)}
                {...form.register("shippingRecipientName")}
              />
              <FieldError message={form.formState.errors.shippingRecipientName?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shippingPhoneNumber">Số điện thoại</Label>
              <Input
                id="shippingPhoneNumber"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(form.formState.errors.shippingPhoneNumber)}
                {...form.register("shippingPhoneNumber")}
              />
              <FieldError message={form.formState.errors.shippingPhoneNumber?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingProvince">Tỉnh hoặc thành phố</Label>
              <Input id="shippingProvince" autoComplete="address-level1" {...form.register("shippingProvince")} />
              <FieldError message={form.formState.errors.shippingProvince?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingDistrict">Quận hoặc huyện</Label>
              <Input id="shippingDistrict" autoComplete="address-level2" {...form.register("shippingDistrict")} />
              <FieldError message={form.formState.errors.shippingDistrict?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingWard">Phường hoặc xã</Label>
              <Input id="shippingWard" {...form.register("shippingWard")} />
              <FieldError message={form.formState.errors.shippingWard?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingStreetAddress">Địa chỉ chi tiết</Label>
              <Input id="shippingStreetAddress" autoComplete="street-address" {...form.register("shippingStreetAddress")} />
              <FieldError message={form.formState.errors.shippingStreetAddress?.message} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Phương thức thanh toán</h2>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(value) => form.setValue("paymentMethod", value as "COD" | "PAYOS")}
            className="mt-5 grid gap-3"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/45">
              <RadioGroupItem value="PAYOS" aria-label="Thanh toán qua PayOS" />
              <CreditCard className="mt-0.5 size-5 text-primary" aria-hidden="true" />
              <span className="flex-1">
                <span className="font-medium">Thanh toán qua PayOS</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  Bạn sẽ được chuyển đến cổng thanh toán PayOS. Đơn hàng chỉ được xác nhận sau khi hệ thống nhận kết quả thanh toán hợp lệ.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/45">
              <RadioGroupItem value="COD" aria-label="Thanh toán khi nhận hàng" />
              <Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" />
              <span className="flex-1">
                <span className="font-medium">Thanh toán khi nhận hàng (COD)</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  Thanh toán bằng tiền mặt cho nhân viên giao hàng khi nhận được đơn hàng.
                </span>
              </span>
            </label>
          </RadioGroup>
          <div className="mt-5 space-y-2">
            <Label htmlFor="shippingNote">Ghi chú đơn hàng</Label>
            <Textarea
              id="shippingNote"
              rows={4}
              placeholder="Ví dụ: giao hàng trong giờ hành chính"
              {...form.register("shippingNote")}
            />
            <FieldError message={form.formState.errors.shippingNote?.message} />
          </div>
        </section>
      </div>

      <div className="lg:sticky lg:top-28">
        <OrderSummary
          subtotal={cart?.subtotal ?? 0}
          shippingFee={0}
          discount={cart?.discountAmount ?? 0}
          total={cart?.total ?? 0}
          action={
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isEmpty || isCartLoading}>
              {isSubmitting
                ? "Đang tạo yêu cầu thanh toán..."
                : paymentMethod === "COD"
                  ? "Đặt hàng (COD)"
                  : "Thanh toán với PayOS"}
            </Button>
          }
        />
        {isEmpty ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Giỏ hàng của bạn đang trống, không thể thanh toán.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Vui lòng không đóng trang trong khi hệ thống đang tạo yêu cầu thanh toán.
          </p>
        )}
      </div>
    </form>
  );
}
