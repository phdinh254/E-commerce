import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { productImagesApi } from "./product-images";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("productImagesApi.list", () => {
  it("calls GET /products/:productId/images and returns the response data", async () => {
    const images = [{ id: "img1" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: images });

    const result = await productImagesApi.list("prod-1");

    expect(get).toHaveBeenCalledWith("/products/prod-1/images", { signal: undefined });
    expect(result).toBe(images);
  });

  it("forwards the AbortSignal", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });
    const controller = new AbortController();

    await productImagesApi.list("prod-1", controller.signal);

    expect(get).toHaveBeenCalledWith("/products/prod-1/images", { signal: controller.signal });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("boom"));
    await expect(productImagesApi.list("prod-1")).rejects.toThrow("boom");
  });
});
