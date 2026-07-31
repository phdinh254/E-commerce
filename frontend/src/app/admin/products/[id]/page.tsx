import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/forms/product-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export const metadata: Metadata = { title: "Chi tiết sản phẩm" };
export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const products = await commerceRepository.getProducts(); const product = products.find((item) => item.id === id); if (!product) notFound(); return <div className="mx-auto max-w-[1400px]"><PageHeader title={product.name} description={`Mã sản phẩm: ${product.id}`} action={<Link href={`/products/${product.slug}`} className={cn(buttonVariants({ variant: "outline" }))}>Xem tại cửa hàng</Link>} /><div className="mt-6"><ProductForm product={product} /></div></div>; }
