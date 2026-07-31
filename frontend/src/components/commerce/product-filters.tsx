"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/commerce";

function FilterContent({ categories, currentCategory }: { categories: Category[]; currentCategory?: string }) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-sm font-semibold">Danh mục</h2>
        <div className="mt-3 grid gap-1">
          <Link href="/products" className={cn("rounded-lg px-3 py-2 text-sm", !currentCategory ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>Tất cả sản phẩm</Link>
          {categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", currentCategory === category.slug ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span>{category.name}</span><span className="text-xs">{category.productCount}</span></Link>)}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Thương hiệu</h2>
        <div className="mt-3 grid gap-3">{["Auralab", "Morrow", "Kanso", "Ordinary", "Loom"].map((brand) => <label key={brand} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label={`Lọc thương hiệu ${brand}`} />{brand}</label>)}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Khoảng giá</h2>
        <div className="mt-3 grid gap-3">{["Dưới 1 triệu", "1 đến 5 triệu", "Trên 5 triệu"].map((range) => <label key={range} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label={`Lọc giá ${range}`} />{range}</label>)}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Tình trạng</h2>
        <label className="mt-3 flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label="Chỉ hiển thị sản phẩm còn hàng" />Còn hàng</label>
      </div>
    </div>
  );
}

export function FilterSidebar(props: { categories: Category[]; currentCategory?: string }) {
  return <aside className="hidden w-64 shrink-0 lg:block" aria-label="Bộ lọc sản phẩm"><FilterContent {...props} /></aside>;
}

export function FilterSheet(props: { categories: Category[]; currentCategory?: string }) {
  return (
    <Sheet>
      <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "lg" }), "lg:hidden")}><SlidersHorizontal aria-hidden="true" />Bộ lọc</SheetTrigger>
      <SheetContent side="left" className="w-[min(88vw,380px)] overflow-y-auto">
        <SheetHeader><SheetTitle>Bộ lọc sản phẩm</SheetTitle><SheetDescription>Thu hẹp kết quả theo nhu cầu của bạn.</SheetDescription></SheetHeader>
        <div className="px-4 pb-8"><FilterContent {...props} /></div>
      </SheetContent>
    </Sheet>
  );
}
