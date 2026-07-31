"use client";

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

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự."),
  phone: z.string().regex(/^[0-9+ ]{9,15}$/, "Số điện thoại chưa hợp lệ."),
  province: z.string().min(2, "Vui lòng nhập tỉnh hoặc thành phố."),
  district: z.string().min(2, "Vui lòng nhập quận hoặc huyện."),
  ward: z.string().min(2, "Vui lòng nhập phường hoặc xã."),
  address: z.string().min(5, "Vui lòng nhập địa chỉ chi tiết."),
  shipping: z.enum(["standard", "express"]),
  payment: z.literal("payos"),
  note: z.string().max(500, "Ghi chú không được vượt quá 500 ký tự.").optional(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

function FieldError({ message }: { message?: string }) { return message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null; }

export function CheckoutForm() {
  const router = useRouter();
  const form = useForm<CheckoutValues>({ resolver: zodResolver(checkoutSchema), defaultValues: { fullName: "Nguyễn Minh Anh", phone: "090 123 4567", province: "TP. Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé", address: "28 Nguyễn Huệ", shipping: "standard", payment: "payos", note: "" } });
  const shipping = useWatch({ control: form.control, name: "shipping" });
  const submit = form.handleSubmit(async () => { try { await new Promise((resolve) => setTimeout(resolve, 650)); toast.success("Đã tạo yêu cầu thanh toán."); router.push("/payment-result?status=pending&order=CM24073101"); } catch { toast.error("Chưa thể tạo yêu cầu thanh toán. Vui lòng thử lại."); } });
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_390px] lg:items-start" noValidate>
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Địa chỉ nhận hàng</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="fullName">Họ và tên</Label><Input id="fullName" autoComplete="name" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} /><FieldError message={form.formState.errors.fullName?.message} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="phone">Số điện thoại</Label><Input id="phone" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(form.formState.errors.phone)} {...form.register("phone")} /><FieldError message={form.formState.errors.phone?.message} /></div><div className="space-y-2"><Label htmlFor="province">Tỉnh hoặc thành phố</Label><Input id="province" autoComplete="address-level1" {...form.register("province")} /><FieldError message={form.formState.errors.province?.message} /></div><div className="space-y-2"><Label htmlFor="district">Quận hoặc huyện</Label><Input id="district" autoComplete="address-level2" {...form.register("district")} /><FieldError message={form.formState.errors.district?.message} /></div><div className="space-y-2"><Label htmlFor="ward">Phường hoặc xã</Label><Input id="ward" {...form.register("ward")} /><FieldError message={form.formState.errors.ward?.message} /></div><div className="space-y-2"><Label htmlFor="address">Địa chỉ chi tiết</Label><Input id="address" autoComplete="street-address" {...form.register("address")} /><FieldError message={form.formState.errors.address?.message} /></div></div></section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Phương thức vận chuyển</h2><RadioGroup value={shipping} onValueChange={(value) => form.setValue("shipping", value as "standard" | "express")} className="mt-5 grid gap-3"><label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><RadioGroupItem value="standard" aria-label="Giao hàng tiêu chuẩn" /><Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="flex justify-between gap-4 font-medium"><span>Giao hàng tiêu chuẩn</span><span>Miễn phí</span></span><span className="mt-1 block text-sm text-muted-foreground">Dự kiến từ 2 đến 4 ngày làm việc</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><RadioGroupItem value="express" aria-label="Giao hàng nhanh" /><Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="flex justify-between gap-4 font-medium"><span>Giao hàng nhanh</span><span>35.000 ₫</span></span><span className="mt-1 block text-sm text-muted-foreground">Dự kiến từ 1 đến 2 ngày làm việc</span></span></label></RadioGroup></section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Thanh toán</h2><div className="mt-5 flex items-start gap-3 rounded-xl border border-primary bg-accent/45 p-4"><CreditCard className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><p className="font-medium">Thanh toán qua PayOS</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Bạn sẽ được chuyển đến cổng thanh toán PayOS. Đơn hàng chỉ được xác nhận sau khi hệ thống nhận kết quả thanh toán hợp lệ.</p></div></div><div className="mt-5 space-y-2"><Label htmlFor="note">Ghi chú đơn hàng</Label><Textarea id="note" rows={4} placeholder="Ví dụ: giao hàng trong giờ hành chính" {...form.register("note")} /><FieldError message={form.formState.errors.note?.message} /></div></section>
      </div>
      <div className="lg:sticky lg:top-28"><OrderSummary subtotal={4670000} shippingFee={shipping === "express" ? 35000 : 0} discount={200000} total={shipping === "express" ? 4505000 : 4470000} action={<Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Đang tạo yêu cầu thanh toán..." : "Thanh toán với PayOS"}</Button>} /><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Vui lòng không đóng trang trong khi hệ thống đang tạo yêu cầu thanh toán.</p></div>
    </form>
  );
}
