import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogFilters } from "./use-catalog-filters";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
  usePathname: () => "/products",
}));

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  searchParams = new URLSearchParams();
});

describe("useCatalogFilters", () => {
  it("parses filters from the current URL", () => {
    searchParams = new URLSearchParams("q=ao&category=ao-thun");
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.q).toBe("ao");
    expect(result.current.filters.categorySlug).toBe("ao-thun");
  });

  it("setCategory pushes a new URL (history entry worth keeping)", () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.setCategory("ao-thun"));
    expect(push).toHaveBeenCalledWith("/products?category=ao-thun", { scroll: false });
    expect(replace).not.toHaveBeenCalled();
  });

  it("setSort pushes a new URL", () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.setSort("price-asc"));
    expect(push).toHaveBeenCalledWith("/products?sort=price-asc", { scroll: false });
  });

  it("setSearch defaults to replace (search typing must not flood history)", () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.setSearch("ao"));
    expect(replace).toHaveBeenCalledWith("/products?q=ao", { scroll: false });
    expect(push).not.toHaveBeenCalled();
  });

  it("clearFilter('q') removes only q, keeping other filters", () => {
    searchParams = new URLSearchParams("q=ao&category=ao-thun");
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.clearFilter("q"));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("q=");
    expect(url).toContain("category=ao-thun");
  });

  it("clearFilter('minPrice') clears both minPrice and maxPrice together", () => {
    searchParams = new URLSearchParams("minPrice=100&maxPrice=200");
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.clearFilter("minPrice"));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("minPrice");
    expect(url).not.toContain("maxPrice");
  });

  it("clearAllFilters resets q/category/price but preserves sort", () => {
    searchParams = new URLSearchParams("q=ao&category=ao-thun&minPrice=1&sort=price-asc");
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.clearAllFilters());
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("q=");
    expect(url).not.toContain("category=");
    expect(url).not.toContain("minPrice");
    expect(url).toContain("sort=price-asc");
  });

  it("navigates to the bare pathname (no '?') when the result has no params", () => {
    searchParams = new URLSearchParams("q=ao");
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.clearFilter("q"));
    expect(push).toHaveBeenCalledWith("/products", { scroll: false });
  });

  it("preserves an unrelated existing param not part of the catalog contract", () => {
    searchParams = new URLSearchParams("utm_source=fb");
    const { result } = renderHook(() => useCatalogFilters());
    act(() => result.current.setCategory("ao-thun"));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("utm_source=fb");
    expect(url).toContain("category=ao-thun");
  });
});
