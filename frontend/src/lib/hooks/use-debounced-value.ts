"use client";

import { useEffect, useState } from "react";

/** Default debounce window for the catalog search box — see docs/catalog.md. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Returns `value`, delayed by `delayMs` of inactivity. A new timer is
 * scheduled only when `value`/`delayMs` change (not on every render), and
 * the pending timer is always cleared on cleanup — so an unmount or a
 * rapid follow-up change can never let a stale timeout fire late and
 * overwrite a newer value.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
