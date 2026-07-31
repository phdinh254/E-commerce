import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem { label: string; href?: string; }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="???ng d?n" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-sm text-muted-foreground">
        <li><Link href="/" className="rounded-md px-1 py-2 hover:text-foreground">Trang ch?</Link></li>
        {items.map((item) => (
          <li key={`${item.label}-${item.href ?? "current"}`} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden="true" />
            {item.href ? <Link href={item.href} className="rounded-md px-1 py-2 hover:text-foreground">{item.label}</Link> : <span className="px-1 py-2 text-foreground" aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
