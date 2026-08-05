import type { ProductApiSortField, ProductApiSortOrder, ProductListQuery } from "@/types/catalog";

/**
 * The 4 sort choices a user can pick, mapped 1:1 to a (sortBy, sortOrder)
 * pair the backend's QueryProductDto actually validates against
 * (PRODUCT_SORT_FIELDS). `null` ("default") deliberately omits `sortBy`
 * from the request entirely — the backend then applies its own default
 * (relevance when `search` is set, `createdAt DESC` otherwise), so the
 * frontend never has to duplicate that branching logic.
 */
export const CATALOG_SORT_OPTIONS = [
  "price-asc",
  "price-desc",
  "name-asc",
  "name-desc",
] as const;
export type CatalogSortOption = (typeof CATALOG_SORT_OPTIONS)[number];

const SORT_OPTION_SET = new Set<string>(CATALOG_SORT_OPTIONS);

export function isCatalogSortOption(value: string): value is CatalogSortOption {
  return SORT_OPTION_SET.has(value);
}

export function sortOptionToApiSort(
  sort: CatalogSortOption,
): { sortBy: ProductApiSortField; sortOrder: ProductApiSortOrder } {
  switch (sort) {
    case "price-asc":
      return { sortBy: "price", sortOrder: "ASC" };
    case "price-desc":
      return { sortBy: "price", sortOrder: "DESC" };
    case "name-asc":
      return { sortBy: "name", sortOrder: "ASC" };
    case "name-desc":
      return { sortBy: "name", sortOrder: "DESC" };
  }
}

/** Parsed, validated, canonical filter state — the URL is only ever a serialization of this. */
export interface CatalogFilters {
  q: string;
  categorySlug: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sort: CatalogSortOption | null;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  categorySlug: null,
  minPrice: null,
  maxPrice: null,
  sort: null,
};

const CATALOG_PARAM_KEYS = ["q", "category", "minPrice", "maxPrice", "sort"] as const;

/** Trims and collapses internal whitespace, mirroring the backend's own search normalization. */
function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** `null` for missing/empty/whitespace/negative/non-finite — never NaN, never a negative price leaks through. */
function parsePriceParam(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) return null;
  return Math.round(value);
}

/**
 * Reads only the whitelisted catalog keys from `params` — never forwards
 * an arbitrary query param to the API, and never lets an invalid value
 * (NaN price, out-of-allowlist sort, empty category) pass through as if
 * it were a real, active filter.
 */
export function parseCatalogSearchParams(params: URLSearchParams): CatalogFilters {
  const rawQ = params.get("q");
  const q = rawQ ? normalizeQuery(rawQ) : "";

  const rawCategory = params.get("category");
  const categorySlug = rawCategory && rawCategory.trim() !== "" ? rawCategory.trim() : null;

  let minPrice = parsePriceParam(params.get("minPrice"));
  let maxPrice = parsePriceParam(params.get("maxPrice"));
  // An invalid combination (min > max) is dropped rather than silently
  // swapped — swapping would hide a genuine input mistake from the user.
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    minPrice = null;
    maxPrice = null;
  }

  const rawSort = params.get("sort");
  const sort = rawSort && isCatalogSortOption(rawSort) ? rawSort : null;

  return { q, categorySlug, minPrice, maxPrice, sort };
}

/**
 * Serializes filters back to search params, starting from `base` (the
 * current URLSearchParams) so any non-catalog param already present is
 * preserved untouched. Default values are omitted entirely — the URL for
 * "no filters" is just the bare path, not `?q=&category=&sort=`.
 */
export function serializeCatalogFilters(
  filters: CatalogFilters,
  base?: URLSearchParams,
): URLSearchParams {
  const result = new URLSearchParams(base);
  for (const key of CATALOG_PARAM_KEYS) result.delete(key);

  if (filters.q !== "") result.set("q", filters.q);
  if (filters.categorySlug) result.set("category", filters.categorySlug);
  if (filters.minPrice !== null) result.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) result.set("maxPrice", String(filters.maxPrice));
  if (filters.sort) result.set("sort", filters.sort);

  return result;
}

export function catalogFiltersHaveActiveFilter(filters: CatalogFilters): boolean {
  return (
    filters.q !== "" ||
    filters.categorySlug !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null
  );
}

/**
 * Builds the exact API query object from validated filters + a resolved
 * category slug->id map. `categoryId === undefined` while `categorySlug`
 * is set means "not resolved yet" (categories still loading) — callers
 * use this to keep the product query disabled until resolution finishes,
 * instead of firing a request with no category filter for one render.
 */
export function catalogFiltersToApiQuery(
  filters: CatalogFilters,
  categorySlugToId: ReadonlyMap<string, string> | null,
): { query: ProductListQuery; categoryPending: boolean } {
  const query: ProductListQuery = {};
  if (filters.q) query.search = filters.q;
  if (filters.minPrice !== null) query.minPrice = filters.minPrice;
  if (filters.maxPrice !== null) query.maxPrice = filters.maxPrice;
  if (filters.sort) {
    const { sortBy, sortOrder } = sortOptionToApiSort(filters.sort);
    query.sortBy = sortBy;
    query.sortOrder = sortOrder;
  }

  if (!filters.categorySlug) {
    return { query, categoryPending: false };
  }
  if (!categorySlugToId) {
    return { query, categoryPending: true };
  }
  const categoryId = categorySlugToId.get(filters.categorySlug);
  if (!categoryId) {
    // Slug present in the URL but doesn't match any known category
    // (stale link, typo) — treated as "no category filter", not as an error.
    return { query, categoryPending: false };
  }
  return { query: { ...query, categoryId }, categoryPending: false };
}
