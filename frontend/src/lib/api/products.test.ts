import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { buildProductListParams, productsApi } from "./products";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildProductListParams", () => {
  it("includes only defined, valid fields", () => {
    expect(
      buildProductListParams({ page: 1, limit: 20, search: "áo thun" }),
    ).toEqual({ page: 1, limit: 20, search: "áo thun" });
  });

  it("omits undefined fields entirely (no literal 'undefined' strings)", () => {
    const params = buildProductListParams({ page: 1 });
    expect(params).toEqual({ page: 1 });
    expect(Object.values(params)).not.toContain("undefined");
  });

  it("omits NaN page/limit/minPrice/maxPrice", () => {
    const params = buildProductListParams({
      page: Number.NaN,
      limit: Number.NaN,
      minPrice: Number.NaN,
      maxPrice: Number.NaN,
    });
    expect(params).toEqual({});
  });

  it("trims search and omits it when blank after trim", () => {
    expect(buildProductListParams({ search: "  áo   " }).search).toBe("áo");
    expect(buildProductListParams({ search: "   " })).toEqual({});
  });

  it("includes categoryId, sortBy, sortOrder, minPrice, maxPrice when present", () => {
    expect(
      buildProductListParams({
        categoryId: "cat-1",
        sortBy: "price",
        sortOrder: "ASC",
        minPrice: 100000,
        maxPrice: 500000,
      }),
    ).toEqual({
      categoryId: "cat-1",
      sortBy: "price",
      sortOrder: "ASC",
      minPrice: 100000,
      maxPrice: 500000,
    });
  });

  it("omits zero-value minPrice/maxPrice only when not a finite number (0 itself is valid)", () => {
    expect(buildProductListParams({ minPrice: 0 }).minPrice).toBe(0);
  });
});

describe("productsApi.list", () => {
  it("calls GET /products with the built params and returns the response data", async () => {
    const paginated = {
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: paginated });

    const result = await productsApi.list({ page: 1, search: "áo" });

    expect(get).toHaveBeenCalledWith("/products", {
      params: { page: 1, search: "áo" },
      signal: undefined,
    });
    expect(result).toBe(paginated);
  });

  it("forwards the AbortSignal to the underlying request", async () => {
    const get = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
    const controller = new AbortController();

    await productsApi.list({ page: 1 }, controller.signal);

    expect(get).toHaveBeenCalledWith(
      "/products",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("does not swallow errors — rejects when the request fails", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("network down"));
    await expect(productsApi.list({})).rejects.toThrow("network down");
  });
});

describe("productsApi.getBySlug", () => {
  it("calls GET /products/slug/:slug and returns the response data", async () => {
    const product = { id: "p1", slug: "tai-nghe" };
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: product });

    const result = await productsApi.getBySlug("tai-nghe");

    expect(get).toHaveBeenCalledWith("/products/slug/tai-nghe", { signal: undefined });
    expect(result).toBe(product);
  });

  it("percent-encodes the slug so it cannot escape the path segment", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: {} });

    await productsApi.getBySlug("a/../b?x=1");

    expect(get).toHaveBeenCalledWith(
      `/products/slug/${encodeURIComponent("a/../b?x=1")}`,
      { signal: undefined },
    );
  });

  it("forwards the AbortSignal", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: {} });
    const controller = new AbortController();

    await productsApi.getBySlug("tai-nghe", controller.signal);

    expect(get).toHaveBeenCalledWith("/products/slug/tai-nghe", { signal: controller.signal });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("not found"));
    await expect(productsApi.getBySlug("missing")).rejects.toThrow("not found");
  });
});
