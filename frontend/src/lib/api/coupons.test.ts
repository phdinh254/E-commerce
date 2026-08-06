import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { couponsApi } from "./coupons";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("couponsApi.getFeatured", () => {
  it("calls GET /coupons/featured and returns the response data", async () => {
    const featured = [{ code: "WELCOME10" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: featured });

    const result = await couponsApi.getFeatured();

    expect(get).toHaveBeenCalledWith("/coupons/featured", {
      params: undefined,
      signal: undefined,
    });
    expect(result).toBe(featured);
  });

  it("passes limit as a query param when given", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

    await couponsApi.getFeatured(3);

    expect(get).toHaveBeenCalledWith("/coupons/featured", {
      params: { limit: 3 },
      signal: undefined,
    });
  });

  it("forwards the AbortSignal", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });
    const controller = new AbortController();

    await couponsApi.getFeatured(undefined, controller.signal);

    expect(get).toHaveBeenCalledWith("/coupons/featured", {
      params: undefined,
      signal: controller.signal,
    });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("network down"));
    await expect(couponsApi.getFeatured()).rejects.toThrow("network down");
  });
});
