import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { productsApi } from "@/lib/api/products";
import { useInfiniteProducts } from "./use-infinite-products";
import { DEFAULT_CATALOG_FILTERS } from "@/lib/catalog/search-params";
import type { PaginatedProducts } from "@/types/catalog";

vi.mock("@/lib/api/products", () => ({
  productsApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function page(items: { id: string }[], page: number, totalPages: number): PaginatedProducts {
  return {
    items: items.map((i) => ({
      id: i.id,
      name: i.id,
      slug: i.id,
      sku: i.id,
      shortDescription: null,
      description: null,
      price: 1000,
      thumbnailUrl: null,
      isActive: true,
      isFeatured: false,
      category: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })),
    meta: { page, limit: 20, total: totalPages * 2, totalPages },
  };
}

describe("useInfiniteProducts", () => {
  it("fetches the first page with page=1", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(page([{ id: "a" }], 1, 2));

    const { result } = renderHook(() => useInfiniteProducts(DEFAULT_CATALOG_FILTERS, null), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(productsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      expect.anything(),
    );
  });

  it("computes hasNextPage from meta.totalPages, not from array length alone", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(page([{ id: "a" }], 1, 1));

    const { result } = renderHook(() => useInfiniteProducts(DEFAULT_CATALOG_FILTERS, null), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetchNextPage requests page 2 and appends", async () => {
    vi.mocked(productsApi.list)
      .mockResolvedValueOnce(page([{ id: "a" }], 1, 2))
      .mockResolvedValueOnce(page([{ id: "b" }], 2, 2));

    const { result } = renderHook(() => useInfiniteProducts(DEFAULT_CATALOG_FILTERS, null), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    void result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(productsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.anything(),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("does not fetch when there is no next page", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(page([{ id: "a" }], 1, 1));
    const { result } = renderHook(() => useInfiniteProducts(DEFAULT_CATALOG_FILTERS, null), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(false);
    // fetchNextPage would be a no-op / not increase call count when there's nothing to fetch.
    const callsBefore = vi.mocked(productsApi.list).mock.calls.length;
    await result.current.fetchNextPage();
    expect(vi.mocked(productsApi.list).mock.calls.length).toBe(callsBefore);
  });

  it("is disabled (does not fetch) while a category slug is set but the id map hasn't loaded", () => {
    renderHook(
      () =>
        useInfiniteProducts({ ...DEFAULT_CATALOG_FILTERS, categorySlug: "ao-thun" }, null),
      { wrapper },
    );
    expect(productsApi.list).not.toHaveBeenCalled();
  });

  it("fetches once the category id map resolves", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(page([], 1, 0));
    const map = new Map([["ao-thun", "cat-uuid"]]);

    const { result } = renderHook(
      () => useInfiniteProducts({ ...DEFAULT_CATALOG_FILTERS, categorySlug: "ao-thun" }, map),
      { wrapper },
    );

    await waitFor(() => expect(productsApi.list).toHaveBeenCalled());
    expect(productsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-uuid" }),
      expect.anything(),
    );
    expect(result.current).toBeDefined();
  });

  it("uses a different query key for different filters (no stale-data leak between filters)", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(page([{ id: "a" }], 1, 1));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteProducts(filters, null),
      { wrapper: localWrapper, initialProps: { filters: DEFAULT_CATALOG_FILTERS } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    vi.mocked(productsApi.list).mockResolvedValue(page([{ id: "b" }], 1, 1));
    rerender({ filters: { ...DEFAULT_CATALOG_FILTERS, q: "áo" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items[0].id).toBe("b");
  });
});
