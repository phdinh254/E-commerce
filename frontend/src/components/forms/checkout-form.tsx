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
  fullName: z.string().min(2, "H? t?n ph?i c? ?t nh?t 2 k? t?."),
  phone: z.string().regex(/^[0-9+ ]{9,15}$/, "S? ?i?n tho?i ch?a h?p l?."),
  province: z.string().min(2, "Vui l?ng nh?p t?nh ho?c th?nh ph?."),
  district: z.string().min(2, "Vui l?ng nh?p qu?n ho?c huy?n."),
  ward: z.string().min(2, "Vui l?ng nh?p ph??ng ho?c x?."),
  address: z.string().min(5, "Vui l?ng nh?p ??a ch? chi ti?t."),
  shipping: z.enum(["standard", "express"]),
  payment: z.literal("payos"),
  note: z.string().max(500, "Ghi ch? t?i ?a 500 k? t?.").optional(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

function FieldError({ message }: { message?: string }) { return message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null; }

export function CheckoutForm() {
  const router = useRouter();
  const form = useForm<CheckoutValues>({ resolver: zodResolver(checkoutSchema), defaultValues: { fullName: "Nguy?n Minh Anh", phone: "090 123 4567", province: "TP. H? Ch? Minh", district: "Qu?n 1", ward: "B?n Ngh?", address: "28 Nguy?n Hu?", shipping: "standard", payment: "payos", note: "" } });
  const shipping = useWatch({ control: form.control, name: "shipping" });
  const submit = form.handleSubmit(async () => { try { await new Promise((resolve) => setTimeout(resolve, 650)); toast.success("?? t?o y?u c?u thanh to?n."); router.push("/payment-result?status=pending&order=CM24073101"); } catch { toast.error("Ch?a th? t?o thanh to?n. Vui l?ng th? l?i."); } });
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_390px] lg:items-start" noValidate>
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">??a ch? nh?n h?ng</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="fullName">H? v? t?n</Label><Input id="fullName" autoComplete="name" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} /><FieldError message={form.formState.errors.fullName?.message} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="phone">S? ?i?n tho?i</Label><Input id="phone" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(form.formState.errors.phone)} {...form.register("phone")} /><FieldError message={form.formState.errors.phone?.message} /></div><div className="space-y-2"><Label htmlFor="province">T?nh ho?c th?nh ph?</Label><Input id="province" autoComplete="address-level1" {...form.register("province")} /><FieldError message={form.formState.errors.province?.message} /></div><div className="space-y-2"><Label htmlFor="district">Qu?n ho?c huy?n</Label><Input id="district" autoComplete="address-level2" {...form.register("district")} /><FieldError message={form.formState.errors.district?.message} /></div><div className="space-y-2"><Label htmlFor="ward">Ph??ng ho?c x?</Label><Input id="ward" {...form.register("ward")} /><FieldError message={form.formState.errors.ward?.message} /></div><div className="space-y-2"><Label htmlFor="address">??a ch? chi ti?t</Label><Input id="address" autoComplete="street-address" {...form.register("address")} /><FieldError message={form.formState.errors.address?.message} /></div></div></section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Ph??ng th?c v?n chuy?n</h2><RadioGroup value={shipping} onValueChange={(value) => form.setValue("shipping", value as "standard" | "express")} className="mt-5 grid gap-3"><label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><RadioGroupItem value="standard" aria-label="Giao h?ng ti?u chu?n" /><Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="flex justify-between gap-4 font-medium"><span>Giao h?ng ti?u chu?n</span><span>Mi?n ph?</span></span><span className="mt-1 block text-sm text-muted-foreground">D? ki?n 2 ??n 4 ng?y l?m vi?c</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><RadioGroupItem value="express" aria-label="Giao h?ng nhanh" /><Truck className="mt-0.5 size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="flex justify-between gap-4 font-medium"><span>Giao h?ng nhanh</span><span>35.000 ?</span></span><span className="mt-1 block text-sm text-muted-foreground">D? ki?n 1 ??n 2 ng?y l?m vi?c</span></span></label></RadioGroup></section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Thanh to?n</h2><div className="mt-5 flex items-start gap-3 rounded-xl border border-primary bg-accent/45 p-4"><CreditCard className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><p className="font-medium">Thanh to?n qua PayOS</p><p className="mt-1 text-sm leading-6 text-muted-foreground">B?n s? ???c chuy?n t?i c?ng thanh to?n. ??n ch? ???c x?c nh?n sau khi backend nh?n webhook h?p l? t? PayOS.</p></div></div><div className="mt-5 space-y-2"><Label htmlFor="note">Ghi ch? ??n h?ng</Label><Textarea id="note" rows={4} placeholder="V? d?: giao h?ng trong gi? h?nh ch?nh" {...form.register("note")} /><FieldError message={form.formState.errors.note?.message} /></div></section>
      </div>
      <div className="lg:sticky lg:top-28"><OrderSummary subtotal={4670000} shippingFee={shipping === "express" ? 35000 : 0} discount={200000} total={shipping === "express" ? 4505000 : 4470000} action={<Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "?ang t?o thanh to?n..." : "Thanh to?n v?i PayOS"}</Button>} /><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Kh?ng ??ng trang trong khi ?ang t?o y?u c?u thanh to?n.</p></div>
    </form>
  );
}
