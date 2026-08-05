import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogActiveFilters } from "./catalog-active-filters";
import { categoriesApi } from "@/lib/api/categories";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
  usePathname: () => "/products",
}));

vi.mock("@/lib/api/categories", () => ({
  categoriesApi: { list: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
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

describe("CatalogActiveFilters", () => {
  it("renders nothing when there are no active filters", () => {
    searchParams = new URLSearchParams();
    const { container } = renderWithClient(<CatalogActiveFilters />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a search chip with the trimmed query", () => {
    searchParams = new URLSearchParams("q=áo thun");
    renderWithClient(<CatalogActiveFilters />);
    expect(screen.getByText(/Từ khóa: áo thun/)).toBeInTheDocument();
  });

  it("renders a price chip formatted in VND, not a raw number", () => {
    searchParams = new URLSearchParams("minPrice=100000&maxPrice=500000");
    renderWithClient(<CatalogActiveFilters />);
    expect(screen.getByText(/100\.000.*500\.000/)).toBeInTheDocument();
  });

  it("resolves the category chip label from real category data, not the raw slug", async () => {
    searchParams = new URLSearchParams("category=ao-thun");
    renderWithClient(<CatalogActiveFilters />);
    expect(await screen.findByText(/Danh mục: Áo thun/)).toBeInTheDocument();
  });

  it("does not show a category chip for an unresolved/unknown slug", async () => {
    searchParams = new URLSearchParams("category=does-not-exist");
    renderWithClient(<CatalogActiveFilters />);
    await waitFor(() => expect(categoriesApi.list).toHaveBeenCalled());
    expect(screen.queryByText(/Danh mục:/)).not.toBeInTheDocument();
  });

  it("removing the q chip pushes a URL without q, keeping other filters", async () => {
    searchParams = new URLSearchParams("q=ao&minPrice=1000");
    renderWithClient(<CatalogActiveFilters />);
    await userEvent.click(screen.getByRole("button", { name: /Xóa bộ lọc: Từ khóa/ }));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("q=");
    expect(url).toContain("minPrice=1000");
  });

  it("shows 'Xóa tất cả' only when a filter is active", () => {
    searchParams = new URLSearchParams("q=ao");
    renderWithClient(<CatalogActiveFilters />);
    expect(screen.getByRole("button", { name: "Xóa tất cả" })).toBeInTheDocument();
  });
});
