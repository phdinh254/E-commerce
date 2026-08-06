"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CreditCard, MapPin, Plus, Truck, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OrderSummary } from "@/components/commerce/order-summary";
import { AddressFormDialog } from "@/components/commerce/address-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/hooks/use-cart";
import { useAddresses } from "@/lib/hooks/use-addresses";
import { usePlaceCodOrder } from "@/lib/hooks/use-place-cod-order";
import { usePlacePayOsOrder } from "@/lib/hooks/use-place-payos-order";
import { getApiErrorMessage } from "@/lib/api/client";
import type { CheckoutPayload } from "@/types/payment";

const checkoutSchema = z.object({
  addressId: z.string().min(1, "Vui lòng chọn địa chỉ giao hàng."),
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
 * would call useCart/useAddresses -> real requests) until auth status has
 * resolved past "loading".
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
  const { data: addresses, isLoading: isAddressesLoading } = useAddresses();
  const placeCod = usePlaceCodOrder();
  const placePayOs = usePlacePayOsOrder();
  const [addAddressOpen, setAddAddressOpen] = useState(false);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { addressId: "", shippingNote: "", paymentMethod: "PAYOS" },
  });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  const selectedAddressId = useWatch({ control: form.control, name: "addressId" });

  // Preselects the default address only when there is no currently valid
  // selection — a user's own active choice is never silently overridden by
  // a default changing elsewhere. This also fires right after adding the
  // very first address (the list changes from empty to non-empty) and
  // after a previously-selected address disappears (e.g. deleted in
  // another tab), both of which correctly fall back to "no valid selection
  // yet" and re-resolve.
  useEffect(() => {
    if (!addresses) return;
    const stillValid = addresses.some((a) => a.id === selectedAddressId);
    if (stillValid) return;
    const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
    form.setValue("addressId", preferred?.id ?? "", { shouldValidate: false });
    // Only re-run when the address list itself changes — not on every
    // keystroke/selection change, which would fight the user's own click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  const isCartEmpty = !isCartLoading && (!cart || cart.items.length === 0);
  const hasNoAddress = !isAddressesLoading && (!addresses || addresses.length === 0);
  const isSubmitting = placeCod.isPending || placePayOs.isPending;
  const canSubmit =
    !isSubmitting &&
    !isCartLoading &&
    !isCartEmpty &&
    !isAddressesLoading &&
    !hasNoAddress &&
    Boolean(selectedAddressId);

  const submit = form.handleSubmit(async (values) => {
    const payload: CheckoutPayload = {
      addressId: values.addressId,
      shippingNote: values.shippingNote || undefined,
    };

    try {
      if (values.paymentMethod === "COD") {
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Địa chỉ nhận hàng</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddAddressOpen(true)}>
              <Plus aria-hidden="true" />
              Thêm địa chỉ
            </Button>
          </div>

          {isAddressesLoading ? (
            <div className="mt-5 h-24 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
          ) : hasNoAddress ? (
            <div className="mt-5 rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Bạn chưa có địa chỉ giao hàng nào. Vui lòng thêm một địa chỉ để tiếp tục.
              </p>
            </div>
          ) : (
            <RadioGroup
              value={selectedAddressId}
              onValueChange={(value) => form.setValue("addressId", value, { shouldValidate: true })}
              className="mt-5 grid gap-3"
            >
              {addresses?.map((address) => (
                <label
                  key={address.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/45"
                >
                  <RadioGroupItem value={address.id} aria-label={address.recipientName} />
                  <MapPin className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {address.label ? `${address.label} · ` : ""}
                      {address.recipientName}
                      {address.isDefault ? (
                        <span className="rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          Mặc định
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{address.phoneNumber}</span>
                    <span className="mt-1 block text-sm leading-6">
                      {address.streetAddress}, {address.ward}, {address.district}, {address.province}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
          <FieldError message={form.formState.errors.addressId?.message} />
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
            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {isSubmitting
                ? "Đang tạo yêu cầu thanh toán..."
                : paymentMethod === "COD"
                  ? "Đặt hàng (COD)"
                  : "Thanh toán với PayOS"}
            </Button>
          }
        />
        {isCartEmpty ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Giỏ hàng của bạn đang trống, không thể thanh toán.
          </p>
        ) : hasNoAddress ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Vui lòng thêm địa chỉ giao hàng trước khi đặt hàng.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Vui lòng không đóng trang trong khi hệ thống đang tạo yêu cầu thanh toán.
          </p>
        )}
      </div>

      <AddressFormDialog open={addAddressOpen} onOpenChange={setAddAddressOpen} />
    </form>
  );
}
