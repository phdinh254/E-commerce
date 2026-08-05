import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { productVariantsApi } from "./product-variants";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("productVariantsApi.list", () => {
  it("calls GET /products/:productId/variants and returns the response data", async () => {
    const variants = [{ id: "v1" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: variants });

    const result = await productVariantsApi.list("prod-1");

    expect(get).toHaveBeenCalledWith("/products/prod-1/variants", { signal: undefined });
    expect(result).toBe(variants);
  });

  it("forwards the AbortSignal", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });
    const controller = new AbortController();

    await productVariantsApi.list("prod-1", controller.signal);

    expect(get).toHaveBeenCalledWith("/products/prod-1/variants", { signal: controller.signal });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("boom"));
    await expect(productVariantsApi.list("prod-1")).rejects.toThrow("boom");
  });
});
