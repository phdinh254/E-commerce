"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/lib/hooks/use-debounced-value";
import { useCatalogFilters } from "@/lib/catalog/use-catalog-filters";

export function CatalogSearchInput({ className }: { className?: string }) {
  const { filters, setSearch } = useCatalogFilters();
  const [draft, setDraft] = useState(filters.q);
  const [isComposing, setIsComposing] = useState(false);
  const lastCommitted = useRef(filters.q);
  const debounced = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);

  // Commit the debounced value to the URL (replace — see
  // use-catalog-filters.ts) once it settles, skipping IME composition so
  // an in-progress Vietnamese input method doesn't get cut off mid-word.
  useEffect(() => {
    if (isComposing) return;
    const trimmed = debounced.trim();
    if (trimmed === lastCommitted.current) return;
    lastCommitted.current = trimmed;
    setSearch(trimmed, "replace");
  }, [debounced, isComposing, setSearch]);

  // External change — Back/Forward, or an "Xóa" chip clearing q elsewhere
  // — resyncs the local draft instead of being clobbered by the debounce
  // effect above on the next tick.
  useEffect(() => {
    if (filters.q !== lastCommitted.current) {
      lastCommitted.current = filters.q;
      setDraft(filters.q);
    }
  }, [filters.q]);

  function commitNow(value: string) {
    const trimmed = value.trim();
    lastCommitted.current = trimmed;
    setSearch(trimmed, "replace");
  }

  return (
    <form
      className={cn("relative flex w-full items-center", className)}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commitNow(draft);
      }}
    >
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input
        aria-label="Tìm kiếm sản phẩm"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(event) => {
          setIsComposing(false);
          setDraft(event.currentTarget.value);
        }}
        placeholder="Tìm sản phẩm theo tên hoặc mã..."
        className="h-11 rounded-xl bg-card pl-9 pr-10"
      />
      {draft ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Xóa từ khóa tìm kiếm"
          className="absolute right-1.5"
          onClick={() => {
            setDraft("");
            commitNow("");
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </form>
  );
}
