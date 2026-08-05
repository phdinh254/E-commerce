import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { productsApi } from "@/lib/api/products";
import { RelatedProducts } from "./related-products";
import type { PaginatedProducts } from "@/types/catalog";

vi.mock("@/lib/api/products", () => ({
  productsApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function product(id: string): PaginatedProducts["items"][number] {
  return {
    id,
    name: `Sản phẩm ${id}`,
    slug: id,
    sku: id,
    shortDescription: null,
    description: null,
    price: 10000,
    thumbnailUrl: null,
    isActive: true,
    isFeatured: false,
    category: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("RelatedProducts", () => {
  it("renders nothing when there is no category (never falls back to the whole catalog)", () => {
    const { container } = render(<RelatedProducts categoryId={undefined} excludeProductId="p1" />, { wrapper });
    expect(container).toBeEmptyDOMElement();
    expect(productsApi.list).not.toHaveBeenCalled();
  });

  it("requests one page scoped to the category, not the whole catalog filtered client-side", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({
      items: [product("a"), product("b")],
      meta: { page: 1, limit: 5, total: 2, totalPages: 1 },
    });
    render(<RelatedProducts categoryId="cat-1" excludeProductId="p1" />, { wrapper });
    await waitFor(() => expect(productsApi.list).toHaveBeenCalled());
    expect(productsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-1" }),
      expect.anything(),
    );
  });

  it("excludes the current product from the results", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({
      items: [product("current"), product("a"), product("b")],
      meta: { page: 1, limit: 5, total: 3, totalPages: 1 },
    });
    render(<RelatedProducts categoryId="cat-1" excludeProductId="current" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Sản phẩm a")).toBeInTheDocument());
    expect(screen.queryByText("Sản phẩm current")).not.toBeInTheDocument();
  });

  it("shows a retry action on error", async () => {
    // A 400-like axios error is not retried (see isRetryableError), so this
    // resolves to an error state within the test's default waitFor timeout.
    vi.mocked(productsApi.list).mockRejectedValue({ isAxiosError: true, response: { status: 400 } });
    render(<RelatedProducts categoryId="cat-1" excludeProductId="p1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Không thể tải sản phẩm liên quan")).toBeInTheDocument());
  });
});
