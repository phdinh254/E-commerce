import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { productAttributesApi } from "./product-attributes";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("productAttributesApi.list", () => {
  it("calls GET /products/:productId/attributes and returns the response data", async () => {
    const attributes = [{ id: "attr1" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: attributes });

    const result = await productAttributesApi.list("prod-1");

    expect(get).toHaveBeenCalledWith("/products/prod-1/attributes", { signal: undefined });
    expect(result).toBe(attributes);
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("boom"));
    await expect(productAttributesApi.list("prod-1")).rejects.toThrow("boom");
  });
});
