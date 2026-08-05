import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { categoriesApi } from "./categories";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("categoriesApi.list", () => {
  it("calls GET /categories with a bounded limit and returns the response data", async () => {
    const paginated = {
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: paginated });

    const result = await categoriesApi.list();

    expect(get).toHaveBeenCalledWith("/categories", {
      params: { limit: 100, sortBy: "displayOrder", sortOrder: "ASC" },
      signal: undefined,
    });
    expect(result).toBe(paginated);
  });

  it("forwards the AbortSignal", async () => {
    const get = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: { items: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } } });
    const controller = new AbortController();

    await categoriesApi.list(controller.signal);

    expect(get).toHaveBeenCalledWith(
      "/categories",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
