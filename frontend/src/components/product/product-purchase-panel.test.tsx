import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProductPurchasePanel } from "./product-purchase-panel";
import { useAuth } from "@/lib/auth/auth-provider";
import { cartApi } from "@/lib/api/cart";
import type { ProductDetail, ProductOption, ProductVariant } from "@/types/product-detail";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/products/tai-nghe",
}));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { addItem: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

function mockAuth(status: "authenticated" | "unauthenticated") {
  vi.mocked(useAuth).mockReturnValue({
    user: status === "authenticated" ? ({ id: "u1" } as never) : null,
    status,
    setUser: vi.fn(),
    logout: vi.fn(),
  });
}

const baseProduct: ProductDetail = {
  id: "p1",
  name: "Tai nghe",
  slug: "tai-nghe",
  sku: "SKU-P1",
  shortDescription: null,
  description: null,
  price: 90000,
  thumbnailUrl: null,
  isActive: true,
  isFeatured: false,
  featuredOrder: 0,
  category: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const colorOption: ProductOption = {
  id: "opt-color",
  name: "Màu sắc",
  displayOrder: 0,
  values: [
    { id: "val-cobalt", value: "Xanh cobalt", displayOrder: 0 },
    { id: "val-graphite", value: "Xám than", displayOrder: 1 },
  ],
};

function variant(id: string, overrides: Partial<ProductVariant>): ProductVariant {
  return {
    id,
    sku: `SKU-${id}`,
    price: 100000,
    stock: 5,
    isActive: true,
    optionValues: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductPurchasePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth("authenticated");
  });

  it("shows the base product price when there are no variants", () => {
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);
    expect(screen.getByText("90.000 ₫")).toBeInTheDocument();
  });

  it("shows the resolved variant's price once one is selected by default", () => {
    const cobalt = variant("v1", {
      price: 120000,
      stock: 5,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt]} />);
    expect(screen.getByText("120.000 ₫")).toBeInTheDocument();
  });

  it("updates price when switching variants", async () => {
    const user = userEvent.setup();
    const cobalt = variant("v1", {
      price: 120000,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    const graphite = variant("v2", {
      price: 150000,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-graphite", value: "Xám than" }],
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt, graphite]} />);
    expect(screen.getByText("120.000 ₫")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Xám than/ }));
    expect(screen.getByText("150.000 ₫")).toBeInTheDocument();
  });

  it("caps the quantity selector at the resolved variant's stock", async () => {
    const user = userEvent.setup();
    const cobalt = variant("v1", {
      stock: 2,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt]} />);
    const increment = screen.getByRole("button", { name: "Tăng số lượng" });
    await user.click(increment); // 1 -> 2
    expect(increment).toBeDisabled(); // stock is 2, can't go further
  });

  it("shows a sold-out message and disables quantity when the resolved variant has 0 stock", () => {
    const outOfStock = variant("v1", {
      stock: 0,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[outOfStock]} />);
    expect(screen.getByText(/tạm hết hàng/)).toBeInTheDocument();
  });

  it("disables add-to-cart while the resolved variant is sold out", () => {
    const outOfStock = variant("v1", {
      stock: 0,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[outOfStock]} />);
    const addButton = screen.getByRole("button", { name: /Thêm vào giỏ hàng/ });
    expect(addButton).toBeDisabled();
  });

  it("guest click never calls the Cart API — redirects to login with a safe redirect back to this page", async () => {
    const user = userEvent.setup();
    mockAuth("unauthenticated");
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);

    await user.click(screen.getByRole("button", { name: /Thêm vào giỏ hàng/ }));

    expect(cartApi.addItem).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent("/products/tai-nghe")}`);
  });

  it("authenticated click sends only productId/variantId/quantity — no price, no userId", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.addItem).mockResolvedValue({
      cartId: "c1",
      items: [],
      totalQuantity: 1,
      subtotal: 90000,
      currency: "VND",
      updatedAt: null,
    });
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);

    await user.click(screen.getByRole("button", { name: /Thêm vào giỏ hàng/ }));

    await waitFor(() => expect(cartApi.addItem).toHaveBeenCalled());
    const [payload] = vi.mocked(cartApi.addItem).mock.calls[0];
    expect(payload).toEqual({ productId: "p1", variantId: undefined, quantity: 1 });
  });

  it("keeps the selected quantity on a failed add (does not reset state)", async () => {
    const user = userEvent.setup();
    vi.mocked(cartApi.addItem).mockRejectedValue(new Error("network down"));
    renderWithProviders(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);

    await user.click(screen.getByRole("button", { name: "Tăng số lượng" })); // quantity -> 2
    await user.click(screen.getByRole("button", { name: /Thêm vào giỏ hàng/ }));

    await waitFor(() => expect(cartApi.addItem).toHaveBeenCalled());
    expect(screen.getByText("2")).toBeInTheDocument(); // quantity output unchanged
  });
});
