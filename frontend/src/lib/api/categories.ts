import { apiClient } from "@/lib/api/client";
import type { PaginatedCategories } from "@/types/catalog";

/** Comfortably above the current catalog's category count; still bounded by the backend's own MAX_LIMIT=100. */
const CATEGORY_LIST_LIMIT = 100;

export const categoriesApi = {
  /** Public endpoint — already scoped to active categories only by the backend (CategoriesService.findAllActive). */
  async list(signal?: AbortSignal): Promise<PaginatedCategories> {
    const response = await apiClient.get<PaginatedCategories>("/categories", {
      params: { limit: CATEGORY_LIST_LIMIT, sortBy: "displayOrder", sortOrder: "ASC" },
      signal,
    });
    return response.data;
  },
};
