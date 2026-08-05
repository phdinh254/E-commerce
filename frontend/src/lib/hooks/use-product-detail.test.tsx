import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { productsApi } from "@/lib/api/products";
import { productVariantsApi } from "@/lib/api/product-variants";
import { productImagesApi } from "@/lib/api/product-images";
import { productOptionsApi } from "@/lib/api/product-options";
import { productAttributesApi } from "@/lib/api/product-attributes";
import { useProductDetail } from "./use-product-detail";

vi.mock("@/lib/api/products", () => ({ productsApi: { getBySlug: vi.fn() } }));
vi.mock("@/lib/api/product-variants", () => ({ productVariantsApi: { list: vi.fn() } }));
vi.mock("@/lib/api/product-images", () => ({ productImagesApi: { list: vi.fn() } }));
vi.mock("@/lib/api/product-options", () => ({ productOptionsApi: { list: vi.fn() } }));
vi.mock("@/lib/api/product-attributes", () => ({ productAttributesApi: { list: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const product = { id: "p1", slug: "tai-nghe", name: "Tai nghe" };

describe("useProductDetail", () => {
  it("fetches the product by slug first, then fetches variants/images/options/attributes once the id is known", async () => {
    vi.mocked(productsApi.getBySlug).mockResolvedValue(product as never);
    vi.mocked(productVariantsApi.list).mockResolvedValue([]);
    vi.mocked(productImagesApi.list).mockResolvedValue([]);
    vi.mocked(productOptionsApi.list).mockResolvedValue([]);
    vi.mocked(productAttributesApi.list).mockResolvedValue([]);

    const { result } = renderHook(() => useProductDetail("tai-nghe"), { wrapper });

    await waitFor(() => expect(result.current.product).toEqual(product));
    await waitFor(() => expect(productVariantsApi.list).toHaveBeenCalledWith("p1", expect.anything()));
    expect(productImagesApi.list).toHaveBeenCalledWith("p1", expect.anything());
    expect(productOptionsApi.list).toHaveBeenCalledWith("p1", expect.anything());
    expect(productAttributesApi.list).toHaveBeenCalledWith("p1", expect.anything());
  });

  it("does not fetch dependent resources before the product id is known", () => {
    vi.mocked(productsApi.getBySlug).mockReturnValue(new Promise(() => {})); // never resolves
    renderHook(() => useProductDetail("tai-nghe"), { wrapper });
    expect(productVariantsApi.list).not.toHaveBeenCalled();
    expect(productImagesApi.list).not.toHaveBeenCalled();
  });

  it("surfaces the product's HTTP error status (e.g. 404) for the caller to act on", async () => {
    const error = { isAxiosError: true, response: { status: 404 } };
    vi.mocked(productsApi.getBySlug).mockRejectedValue(error);

    const { result } = renderHook(() => useProductDetail("missing"), { wrapper });

    await waitFor(() => expect(result.current.isProductError).toBe(true));
  });
});
