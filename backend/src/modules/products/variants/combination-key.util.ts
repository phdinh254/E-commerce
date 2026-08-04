import { createHash } from 'crypto';

export interface OptionValuePair {
  optionId: string;
  optionValueId: string;
}

/**
 * Canonical, order-independent identity for a variant's option-value
 * combination. Sorted by optionId (stable regardless of the order the
 * client sent optionValueIds in) before hashing, so two requests for the
 * same logical combination always produce the same key — and are then
 * caught by the database's `(product_id, combination_key)` unique
 * constraint, not just an application-level check.
 */
export function buildCombinationKey(pairs: OptionValuePair[]): string {
  const canonical = [...pairs]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((pair) => `${pair.optionId}:${pair.optionValueId}`)
    .join(',');
  return createHash('sha256').update(canonical).digest('hex');
}
