import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export const metadata: Metadata = { title: "Tạo sản phẩm" };
export default function NewProductPage() { return <div className="mx-auto max-w-[1400px]"><Link href="/admin/products" className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}><ChevronLeft aria-hidden="true" />Quay lại danh sách sản phẩm</Link><PageHeader title="Tạo sản phẩm" description="Thiết lập thông tin bán hàng, tồn kho và hình ảnh sản phẩm." /><div className="mt-6"><ProductForm /></div></div>; }
