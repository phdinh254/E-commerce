"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchBox({ defaultValue = "", compact = false, className }: { defaultValue?: string; compact?: boolean; className?: string }) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();
  return (
    <form className={cn("relative flex w-full items-center", className)} role="search" onSubmit={(event) => { event.preventDefault(); const value = query.trim(); router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/products"); }}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input aria-label="Tìm kiếm sản phẩm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm, thương hiệu..." className={cn("h-11 rounded-xl bg-card pl-9 pr-20", compact && "h-10")} />
      <Button type="submit" size="sm" className="absolute right-1.5">Tìm</Button>
    </form>
  );
}
