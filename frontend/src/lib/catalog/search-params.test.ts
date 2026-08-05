import { describe, it, expect } from "vitest";
import {
  DEFAULT_CATALOG_FILTERS,
  catalogFiltersHaveActiveFilter,
  catalogFiltersToApiQuery,
  parseCatalogSearchParams,
  serializeCatalogFilters,
} from "./search-params";

function sp(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseCatalogSearchParams", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseCatalogSearchParams(sp(""))).toEqual(DEFAULT_CATALOG_FILTERS);
  });

  it("treats an empty q param as no search", () => {
    expect(parseCatalogSearchParams(sp("q=")).q).toBe("");
  });

  it("trims and collapses whitespace in q, preserving Vietnamese diacritics", () => {
    expect(parseCatalogSearchParams(sp("q=" + encodeURIComponent("  áo   thun  "))).q).toBe(
      "áo thun",
    );
  });

  it("parses a category slug", () => {
    expect(parseCatalogSearchParams(sp("category=ao-thun")).categorySlug).toBe("ao-thun");
  });

  it("treats an empty category param as no category", () => {
    expect(parseCatalogSearchParams(sp("category=")).categorySlug).toBeNull();
  });

  it("collapses a duplicated category param to the first value", () => {
    expect(parseCatalogSearchParams(sp("category=a&category=b")).categorySlug).toBe("a");
  });

  it("parses valid minPrice/maxPrice", () => {
    const filters = parseCatalogSearchParams(sp("minPrice=100000&maxPrice=500000"));
    expect(filters.minPrice).toBe(100000);
    expect(filters.maxPrice).toBe(500000);
  });

  it("drops a NaN minPrice", () => {
    expect(parseCatalogSearchParams(sp("minPrice=not-a-number")).minPrice).toBeNull();
  });

  it("drops a negative minPrice", () => {
    expect(parseCatalogSearchParams(sp("minPrice=-100")).minPrice).toBeNull();
  });

  it("drops both minPrice and maxPrice when minPrice > maxPrice", () => {
    const filters = parseCatalogSearchParams(sp("minPrice=500000&maxPrice=100000"));
    expect(filters.minPrice).toBeNull();
    expect(filters.maxPrice).toBeNull();
  });

  it("allows minPrice equal to maxPrice", () => {
    const filters = parseCatalogSearchParams(sp("minPrice=200000&maxPrice=200000"));
    expect(filters.minPrice).toBe(200000);
    expect(filters.maxPrice).toBe(200000);
  });

  it("drops a sort value outside the allowlist", () => {
    expect(parseCatalogSearchParams(sp("sort=price-asc; DROP TABLE products")).sort).toBeNull();
  });

  it("accepts a whitelisted sort value", () => {
    expect(parseCatalogSearchParams(sp("sort=price-asc")).sort).toBe("price-asc");
  });

  it("ignores unrelated params not part of the catalog contract", () => {
    const filters = parseCatalogSearchParams(sp("utm_source=fb&q=ao"));
    expect(filters.q).toBe("ao");
    expect(filters).not.toHaveProperty("utm_source");
  });
});

describe("serializeCatalogFilters", () => {
  it("produces an empty string for default filters", () => {
    expect(serializeCatalogFilters(DEFAULT_CATALOG_FILTERS).toString()).toBe("");
  });

  it("round-trips through parse", () => {
    const filters = parseCatalogSearchParams(
      sp("q=ao&category=ao-thun&minPrice=1&maxPrice=2&sort=name-desc"),
    );
    const serialized = serializeCatalogFilters(filters);
    expect(parseCatalogSearchParams(serialized)).toEqual(filters);
  });

  it("preserves unrelated params already present in the base URLSearchParams", () => {
    const base = sp("utm_source=fb");
    const serialized = serializeCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, q: "ao" }, base);
    expect(serialized.get("utm_source")).toBe("fb");
    expect(serialized.get("q")).toBe("ao");
  });

  it("removes a stale catalog key when clearing back to default", () => {
    const base = sp("q=ao&category=ao-thun");
    const serialized = serializeCatalogFilters(DEFAULT_CATALOG_FILTERS, base);
    expect(serialized.toString()).toBe("");
  });
});

describe("catalogFiltersHaveActiveFilter", () => {
  it("is false for defaults", () => {
    expect(catalogFiltersHaveActiveFilter(DEFAULT_CATALOG_FILTERS)).toBe(false);
  });

  it("is true when q is set", () => {
    expect(catalogFiltersHaveActiveFilter({ ...DEFAULT_CATALOG_FILTERS, q: "ao" })).toBe(true);
  });

  it("is false when only sort is set (sort is a separate control, not a 'filter chip')", () => {
    expect(
      catalogFiltersHaveActiveFilter({ ...DEFAULT_CATALOG_FILTERS, sort: "price-asc" }),
    ).toBe(false);
  });
});

describe("catalogFiltersToApiQuery", () => {
  it("maps sort option to sortBy/sortOrder", () => {
    const { query } = catalogFiltersToApiQuery(
      { ...DEFAULT_CATALOG_FILTERS, sort: "price-asc" },
      null,
    );
    expect(query.sortBy).toBe("price");
    expect(query.sortOrder).toBe("ASC");
  });

  it("omits sortBy/sortOrder when sort is null (let the backend decide the default)", () => {
    const { query } = catalogFiltersToApiQuery(DEFAULT_CATALOG_FILTERS, null);
    expect(query.sortBy).toBeUndefined();
    expect(query.sortOrder).toBeUndefined();
  });

  it("marks categoryPending=true when a category slug is set but the map isn't loaded yet", () => {
    const { categoryPending, query } = catalogFiltersToApiQuery(
      { ...DEFAULT_CATALOG_FILTERS, categorySlug: "ao-thun" },
      null,
    );
    expect(categoryPending).toBe(true);
    expect(query.categoryId).toBeUndefined();
  });

  it("resolves categoryId once the map is loaded", () => {
    const map = new Map([["ao-thun", "uuid-1"]]);
    const { categoryPending, query } = catalogFiltersToApiQuery(
      { ...DEFAULT_CATALOG_FILTERS, categorySlug: "ao-thun" },
      map,
    );
    expect(categoryPending).toBe(false);
    expect(query.categoryId).toBe("uuid-1");
  });

  it("treats an unknown category slug as no filter (not pending, not an error)", () => {
    const map = new Map<string, string>();
    const { categoryPending, query } = catalogFiltersToApiQuery(
      { ...DEFAULT_CATALOG_FILTERS, categorySlug: "does-not-exist" },
      map,
    );
    expect(categoryPending).toBe(false);
    expect(query.categoryId).toBeUndefined();
  });

  it("never sends categoryPending as part of the query itself", () => {
    const { query } = catalogFiltersToApiQuery(DEFAULT_CATALOG_FILTERS, null);
    expect(query).not.toHaveProperty("categoryPending");
  });
});
