import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect, useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogPage } from "./catalog-page";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import type { PaginatedProducts } from "@/types/catalog";

// A minimal fake router: push/replace mutate a shared "current URL" and
// notify subscribers, so CatalogPage's real useSearchParams()-derived
// state actually re-renders on navigation — the same way the real
// Next.js App Router would, just without a browser.
let currentSearch = "";
const listeners = new Set<() => void>();
function navigate(url: string) {
  currentSearch = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  listeners.forEach((l) => l());
}
const push = vi.fn((url: string) => navigate(url));
const replace = vi.fn((url: string) => navigate(url));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/products",
  useSearchParams: () => {
    const [, forceRender] = useState(0);
    useEffect(() => {
      const listener = () => forceRender((n) => n + 1);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return new URLSearchParams(currentSearch);
  },
}));

vi.mock("@/lib/api/products", () => ({ productsApi: { list: vi.fn() } }));
vi.mock("@/lib/api/categories", () => ({ categoriesApi: { list: vi.fn() } }));

function buildProducts(names: string[], page: number, totalPages: number): PaginatedProducts {
  return {
    items: names.map((name, i) => ({
      id: `${page}-${i}-${name}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      sku: name,
      shortDescription: null,
      description: null,
      price: 100000,
      thumbnailUrl: null,
      isActive: true,
      isFeatured: false,
      category: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })),
    meta: { page, limit: 20, total: totalPages * names.length, totalPages },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CatalogPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentSearch = "";
  push.mockClear();
  replace.mockClear();
  vi.mocked(categoriesApi.list).mockResolvedValue({
    items: [
      {
        id: "cat-1",
        parentId: null,
        name: "Áo thun",
        slug: "ao-thun",
        description: null,
        imageUrl: null,
        displayOrder: 0,
        isActive: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });
});

describe("CatalogPage integration", () => {
  it("opening a URL with a search filter reflects in the search input and calls the API with search", async () => {
    currentSearch = "q=áo";
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts(["Áo thun A"], 1, 1));

    renderPage();

    await waitFor(() =>
      expect(productsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: "áo" }),
        expect.anything(),
      ),
    );
    expect(screen.getByLabelText("Tìm kiếm sản phẩm")).toHaveValue("áo");
    expect(await screen.findByText("Áo thun A")).toBeInTheDocument();
  });

  it("typing in the search box only calls the API once after debounce settles", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts(["X"], 1, 1));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("X"); // initial catalog load has settled
    const callsBeforeTyping = vi.mocked(productsApi.list).mock.calls.length;

    const input = screen.getByLabelText("Tìm kiếm sản phẩm");
    await user.type(input, "ao");

    // While still within the debounce window, no new request yet.
    expect(vi.mocked(productsApi.list).mock.calls.length).toBe(callsBeforeTyping);

    await waitFor(
      () =>
        expect(productsApi.list).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "ao" }),
          expect.anything(),
        ),
      { timeout: 2000 },
    );
    // Exactly one additional request for the whole "ao" typing burst — not
    // one per keystroke.
    expect(vi.mocked(productsApi.list).mock.calls.length).toBe(callsBeforeTyping + 1);
  });

  it("selecting a category updates the URL and refetches with categoryId", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts(["X"], 1, 1));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(productsApi.list).toHaveBeenCalled());

    const sidebar = await screen.findByRole("radiogroup", { name: "Lọc theo danh mục" });
    await user.click(within(sidebar).getByRole("radio", { name: "Áo thun" }));

    expect(push).toHaveBeenCalledWith("/products?category=ao-thun", { scroll: false });
    await waitFor(() =>
      expect(productsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: "cat-1" }),
        expect.anything(),
      ),
    );
  });

  it("changing sort updates the URL and starts the product list over (no leftover pageParam)", async () => {
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts(["X"], 1, 2));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(productsApi.list).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText("Sắp xếp sản phẩm"), "price-asc");

    expect(push).toHaveBeenCalledWith("/products?sort=price-asc", { scroll: false });
    await waitFor(() =>
      expect(productsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "price", sortOrder: "ASC", page: 1 }),
        expect.anything(),
      ),
    );
  });

  it("removing a filter chip updates the URL and results", async () => {
    currentSearch = "q=ao";
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts(["Ao san pham"], 1, 1));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ao san pham");

    await user.click(screen.getByRole("button", { name: /Xóa bộ lọc: Từ khóa/ }));
    expect(push).toHaveBeenCalledWith("/products", { scroll: false });
  });

  it("loading the next page appends products without duplicating the first page", async () => {
    vi.mocked(productsApi.list)
      .mockResolvedValueOnce(buildProducts(["First"], 1, 2))
      .mockResolvedValueOnce(buildProducts(["Second"], 2, 2));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("First");
    await user.click(screen.getByRole("button", { name: "Xem thêm sản phẩm" }));

    await screen.findByText("Second");
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getAllByText("First")).toHaveLength(1);
  });

  it("renders the empty-with-filter state (not an error) when the API returns zero items", async () => {
    currentSearch = "q=khong-ton-tai";
    vi.mocked(productsApi.list).mockResolvedValue(buildProducts([], 1, 0));
    renderPage();

    expect(await screen.findByText("Không tìm thấy sản phẩm phù hợp")).toBeInTheDocument();
  });

  it("shows the initial error state and retries successfully, keeping the same filters", async () => {
    currentSearch = "category=ao-thun";
    // A 400-shaped error so useInfiniteProducts' retry policy treats it as
    // non-retryable (see isRetryableError) — the point of this test is the
    // manual retry button, not the automatic-retry backoff.
    const clientError = Object.assign(new Error("Bad Request"), {
      isAxiosError: true,
      response: { status: 400 },
    });
    vi.mocked(productsApi.list)
      .mockRejectedValueOnce(clientError)
      .mockResolvedValueOnce(buildProducts(["Recovered"], 1, 1));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Không thể tải danh sách sản phẩm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(productsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: "cat-1" }),
      expect.anything(),
    );
  });
});
