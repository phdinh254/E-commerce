import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { productOptionsApi } from "./product-options";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("productOptionsApi.list", () => {
  it("calls GET /products/:productId/options and returns the response data", async () => {
    const options = [{ id: "opt1" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: options });

    const result = await productOptionsApi.list("prod-1");

    expect(get).toHaveBeenCalledWith("/products/prod-1/options", { signal: undefined });
    expect(result).toBe(options);
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("boom"));
    await expect(productOptionsApi.list("prod-1")).rejects.toThrow("boom");
  });
});
