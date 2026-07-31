"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/forms/image-uploader";
import type { Product } from "@/types/commerce";

const schema = z.object({ name: z.string().min(2, "T?n s?n ph?m qu? ng?n."), slug: z.string().min(2, "Slug kh?ng h?p l?.").regex(/^[a-z0-9-]+$/, "Slug ch? g?m ch? th??ng, s? v? d?u g?ch n?i."), brand: z.string().min(1, "Vui l?ng ch?n th??ng hi?u."), category: z.string().min(1, "Vui l?ng ch?n danh m?c."), price: z.number().positive("Gi? ph?i l?n h?n 0."), stock: z.number().int().min(0, "T?n kho kh?ng th? ?m."), description: z.string().min(20, "M? t? c?n ?t nh?t 20 k? t?.") });
type Values = z.infer<typeof schema>;

export function ProductForm({ product }: { product?: Product }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: product?.name ?? "", slug: product?.slug ?? "", brand: product?.brand ?? "", category: product?.category ?? "", price: product?.price ?? 0, stock: product?.stock ?? 0, description: product?.description ?? "" } });
  const submit = form.handleSubmit(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); toast.success(product ? "?? c?p nh?t s?n ph?m trong giao di?n m?u." : "?? t?o s?n ph?m trong giao di?n m?u."); });
  const error = (name: keyof Values) => form.formState.errors[name]?.message;
  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]" noValidate>
      <div className="space-y-6"><section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Th?ng tin c? b?n</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-name">T?n s?n ph?m</Label><Input id="product-name" {...form.register("name")} aria-invalid={Boolean(error("name"))} />{error("name") ? <p className="text-sm text-destructive">{error("name")}</p> : null}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-slug">Slug</Label><Input id="product-slug" {...form.register("slug")} aria-invalid={Boolean(error("slug"))} /><p className="text-xs text-muted-foreground">Slug ?n ??nh gi?p b?o to?n URL v? SEO.</p>{error("slug") ? <p className="text-sm text-destructive">{error("slug")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-brand">Th??ng hi?u</Label><Input id="product-brand" {...form.register("brand")} />{error("brand") ? <p className="text-sm text-destructive">{error("brand")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-category">Danh m?c</Label><Input id="product-category" {...form.register("category")} />{error("category") ? <p className="text-sm text-destructive">{error("category")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-price">Gi? b?n</Label><Input id="product-price" type="number" min="0" inputMode="numeric" {...form.register("price", { valueAsNumber: true })} />{error("price") ? <p className="text-sm text-destructive">{error("price")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-stock">T?n kho</Label><Input id="product-stock" type="number" min="0" inputMode="numeric" {...form.register("stock", { valueAsNumber: true })} />{error("stock") ? <p className="text-sm text-destructive">{error("stock")}</p> : null}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-description">M? t?</Label><Textarea id="product-description" rows={7} {...form.register("description")} />{error("description") ? <p className="text-sm text-destructive">{error("description")}</p> : null}</div></div></section></div>
      <aside className="space-y-6"><section className="rounded-2xl border bg-card p-5"><ImageUploader initialImage={product?.image} /></section><section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Xu?t b?n</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Ki?m tra gi?, t?n kho, ?nh v? n?i dung tr??c khi l?u.</p><Button type="submit" size="lg" className="mt-5 w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "?ang l?u..." : product ? "L?u thay ??i" : "T?o s?n ph?m"}</Button></section></aside>
    </form>
  );
}
