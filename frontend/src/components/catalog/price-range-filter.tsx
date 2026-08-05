"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function parseNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/**
 * Self-contained price range control: keeps its own text-input draft
 * (never sends a raw currency-formatted string or NaN to the caller) and
 * only calls `onApply` once the user explicitly confirms — never on every
 * keystroke, so neither desktop (immediate URL push) nor the mobile
 * drawer (local batch draft) accidentally fires a request per digit
 * typed. `value` re-syncs the draft whenever it changes externally (URL
 * navigation, drawer re-opened, "Xóa" chip).
 */
export function PriceRangeFilter({
  value,
  onApply,
  idPrefix,
}: {
  value: { min: number | null; max: number | null };
  onApply: (min: number | null, max: number | null) => void;
  idPrefix: string;
}) {
  const [minText, setMinText] = useState(value.min === null ? "" : String(value.min));
  const [maxText, setMaxText] = useState(value.max === null ? "" : String(value.max));
  // Derived-during-render resync (React's documented alternative to an
  // effect for "adjust state when a prop changes"): tracks the last
  // `value` this component rendered a draft for, and snaps the draft back
  // to it the moment `value` changes externally (URL navigation, drawer
  // reopened, "Xóa" chip) — without the extra render-then-effect-then-
  // render round trip a useEffect would cause.
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue.min !== value.min || syncedValue.max !== value.max) {
    setSyncedValue(value);
    setMinText(value.min === null ? "" : String(value.min));
    setMaxText(value.max === null ? "" : String(value.max));
  }

  const min = parseNonNegativeInt(minText);
  const max = parseNonNegativeInt(maxText);
  const hasRangeError = min !== null && max !== null && min > max;
  const hasParseError = (minText.trim() !== "" && min === null) || (maxText.trim() !== "" && max === null);
  const errorId = `${idPrefix}-price-error`;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${idPrefix}-min-price`} className="text-xs text-muted-foreground">
            Từ (₫)
          </Label>
          <Input
            id={`${idPrefix}-min-price`}
            inputMode="numeric"
            value={minText}
            onChange={(event) => setMinText(event.target.value)}
            aria-invalid={hasRangeError || hasParseError}
            aria-describedby={hasRangeError || hasParseError ? errorId : undefined}
            className="mt-1 h-10"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-max-price`} className="text-xs text-muted-foreground">
            Đến (₫)
          </Label>
          <Input
            id={`${idPrefix}-max-price`}
            inputMode="numeric"
            value={maxText}
            onChange={(event) => setMaxText(event.target.value)}
            aria-invalid={hasRangeError || hasParseError}
            aria-describedby={hasRangeError || hasParseError ? errorId : undefined}
            className="mt-1 h-10"
          />
        </div>
      </div>
      {hasRangeError ? (
        <p id={errorId} className="mt-2 text-xs text-destructive">
          Giá thấp nhất không được lớn hơn giá cao nhất.
        </p>
      ) : hasParseError ? (
        <p id={errorId} className="mt-2 text-xs text-destructive">
          Vui lòng nhập số hợp lệ, không âm.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        disabled={hasRangeError || hasParseError}
        onClick={() => onApply(min, max)}
      >
        Áp dụng khoảng giá
      </Button>
    </div>
  );
}
