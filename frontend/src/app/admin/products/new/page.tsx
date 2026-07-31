import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export const metadata: Metadata = { title: "T?o s?n ph?m" };
export default function NewProductPage() { return <div className="mx-auto max-w-[1400px]"><Link href="/admin/products" className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}><ChevronLeft aria-hidden="true" />Quay l?i s?n ph?m</Link><PageHeader title="T?o s?n ph?m" description="Thi?t l?p th?ng tin b?n h?ng, t?n kho v? h?nh ?nh s?n ph?m." /><div className="mt-6"><ProductForm /></div></div>; }
