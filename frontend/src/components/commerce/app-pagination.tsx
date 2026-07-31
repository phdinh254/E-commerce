import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppPagination({ current = 1, total = 3, basePath = "/products" }: { current?: number; total?: number; basePath?: string }) {
  return (
    <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Phân trang">
      <Link href={`${basePath}?page=${Math.max(1, current - 1)}`} aria-label="Trang trước" aria-disabled={current === 1} className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), current === 1 && "pointer-events-none opacity-50")}><ChevronLeft aria-hidden="true" /></Link>
      {Array.from({ length: total }, (_, index) => index + 1).map((page) => <Link key={page} href={`${basePath}?page=${page}`} aria-current={page === current ? "page" : undefined} className={cn(buttonVariants({ variant: page === current ? "default" : "ghost", size: "icon-lg" }))}>{page}</Link>)}
      <Link href={`${basePath}?page=${Math.min(total, current + 1)}`} aria-label="Trang sau" aria-disabled={current === total} className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), current === total && "pointer-events-none opacity-50")}><ChevronRight aria-hidden="true" /></Link>
    </nav>
  );
}
