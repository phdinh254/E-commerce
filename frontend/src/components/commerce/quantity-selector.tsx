"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuantitySelector({ value, onChange, max = 99, disabled = false }: { value: number; onChange: (value: number) => void; max?: number; disabled?: boolean }) {
  return (
    <div className="inline-flex h-11 items-center rounded-xl border bg-card" role="group" aria-label="S? l??ng">
      <Button type="button" variant="ghost" size="icon-lg" aria-label="Gi?m s? l??ng" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus aria-hidden="true" /></Button>
      <output className="min-w-10 text-center text-sm font-semibold" aria-live="polite">{value}</output>
      <Button type="button" variant="ghost" size="icon-lg" aria-label="T?ng s? l??ng" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus aria-hidden="true" /></Button>
    </div>
  );
}
