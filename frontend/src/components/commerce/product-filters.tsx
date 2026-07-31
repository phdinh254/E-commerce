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
        <h2 className="text-sm font-semibold">Danh m?c</h2>
        <div className="mt-3 grid gap-1">
          <Link href="/products" className={cn("rounded-lg px-3 py-2 text-sm", !currentCategory ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>T?t c? s?n ph?m</Link>
          {categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", currentCategory === category.slug ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span>{category.name}</span><span className="text-xs">{category.productCount}</span></Link>)}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Th??ng hi?u</h2>
        <div className="mt-3 grid gap-3">{["Auralab", "Morrow", "Kanso", "Ordinary", "Loom"].map((brand) => <label key={brand} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label={`L?c th??ng hi?u ${brand}`} />{brand}</label>)}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Kho?ng gi?</h2>
        <div className="mt-3 grid gap-3">{["D??i 1 tri?u", "1 ??n 5 tri?u", "Tr?n 5 tri?u"].map((range) => <label key={range} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label={`L?c gi? ${range}`} />{range}</label>)}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">T?nh tr?ng</h2>
        <label className="mt-3 flex min-h-9 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><Checkbox aria-label="Ch? hi?n th? s?n ph?m c?n h?ng" />C?n h?ng</label>
      </div>
    </div>
  );
}

export function FilterSidebar(props: { categories: Category[]; currentCategory?: string }) {
  return <aside className="hidden w-64 shrink-0 lg:block" aria-label="B? l?c s?n ph?m"><FilterContent {...props} /></aside>;
}

export function FilterSheet(props: { categories: Category[]; currentCategory?: string }) {
  return (
    <Sheet>
      <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "lg" }), "lg:hidden")}><SlidersHorizontal aria-hidden="true" />B? l?c</SheetTrigger>
      <SheetContent side="left" className="w-[min(88vw,380px)] overflow-y-auto">
        <SheetHeader><SheetTitle>B? l?c s?n ph?m</SheetTitle><SheetDescription>Thu h?p k?t qu? theo nhu c?u c?a b?n.</SheetDescription></SheetHeader>
        <div className="px-4 pb-8"><FilterContent {...props} /></div>
      </SheetContent>
    </Sheet>
  );
}
