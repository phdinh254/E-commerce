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

const schema = z.object({ name: z.string().min(2, "Tên sản phẩm quá ngắn."), slug: z.string().min(2, "Slug không hợp lệ.").regex(/^[a-z0-9-]+$/, "Slug chỉ gồm chữ thường, số và dấu gạch nối."), brand: z.string().min(1, "Vui lòng chọn thương hiệu."), category: z.string().min(1, "Vui lòng chọn danh mục."), price: z.number().positive("Giá phải lớn hơn 0."), stock: z.number().int().min(0, "Tồn kho không thể âm."), description: z.string().min(20, "Mô tả cần ít nhất 20 ký tự.") });
type Values = z.infer<typeof schema>;

export function ProductForm({ product }: { product?: Product }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: product?.name ?? "", slug: product?.slug ?? "", brand: product?.brand ?? "", category: product?.category ?? "", price: product?.price ?? 0, stock: product?.stock ?? 0, description: product?.description ?? "" } });
  const submit = form.handleSubmit(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); toast.success(product ? "Đã cập nhật sản phẩm trong bản dùng thử." : "Đã tạo sản phẩm trong bản dùng thử."); });
  const error = (name: keyof Values) => form.formState.errors[name]?.message;
  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]" noValidate>
      <div className="space-y-6"><section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Thông tin cơ bản</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-name">Tên sản phẩm</Label><Input id="product-name" {...form.register("name")} aria-invalid={Boolean(error("name"))} />{error("name") ? <p className="text-sm text-destructive">{error("name")}</p> : null}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-slug">Slug</Label><Input id="product-slug" {...form.register("slug")} aria-invalid={Boolean(error("slug"))} /><p className="text-xs text-muted-foreground">Slug ổn định giúp bảo toàn URL và hỗ trợ SEO.</p>{error("slug") ? <p className="text-sm text-destructive">{error("slug")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-brand">Thương hiệu</Label><Input id="product-brand" {...form.register("brand")} />{error("brand") ? <p className="text-sm text-destructive">{error("brand")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-category">Danh mục</Label><Input id="product-category" {...form.register("category")} />{error("category") ? <p className="text-sm text-destructive">{error("category")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-price">Giá bán</Label><Input id="product-price" type="number" min="0" inputMode="numeric" {...form.register("price", { valueAsNumber: true })} />{error("price") ? <p className="text-sm text-destructive">{error("price")}</p> : null}</div><div className="space-y-2"><Label htmlFor="product-stock">Tồn kho</Label><Input id="product-stock" type="number" min="0" inputMode="numeric" {...form.register("stock", { valueAsNumber: true })} />{error("stock") ? <p className="text-sm text-destructive">{error("stock")}</p> : null}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="product-description">Mô tả</Label><Textarea id="product-description" rows={7} {...form.register("description")} />{error("description") ? <p className="text-sm text-destructive">{error("description")}</p> : null}</div></div></section></div>
      <aside className="space-y-6"><section className="rounded-2xl border bg-card p-5"><ImageUploader initialImage={product?.image} /></section><section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Xuất bản</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Kiểm tra giá, tồn kho, hình ảnh và nội dung trước khi lưu.</p><Button type="submit" size="lg" className="mt-5 w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Đang lưu..." : product ? "Lưu thay đổi" : "Tạo sản phẩm"}</Button></section></aside>
    </form>
  );
}
