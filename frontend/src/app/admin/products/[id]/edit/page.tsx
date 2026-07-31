import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/forms/product-form";
export const metadata: Metadata = { title: "Chỉnh sửa sản phẩm" };
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const product = (await commerceRepository.getProducts()).find((item) => item.id === id); if (!product) notFound(); return <div className="mx-auto max-w-[1400px]"><PageHeader title={`Chỉnh sửa ${product.name}`} description="Cập nhật thông tin bán hàng, tồn kho và nội dung sản phẩm." /><div className="mt-6"><ProductForm product={product} /></div></div>; }
