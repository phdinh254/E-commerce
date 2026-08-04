/**
 * Case-insensitive normalization for short labels (option names, option
 * values, attribute names) — trims, collapses internal whitespace, and
 * lowercases, but deliberately does NOT strip diacritics like `slugify()`
 * does: "Đỏ" and "Do" must stay distinct, since they are different
 * Vietnamese words, not the same word in different cases. Only used to
 * detect case/whitespace-only duplicates, never for display or URLs.
 */
export function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
