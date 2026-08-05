import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductPurchasePanel } from "./product-purchase-panel";
import type { ProductDetail, ProductOption, ProductVariant } from "@/types/product-detail";

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
  it("shows the base product price when there are no variants", () => {
    render(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);
    expect(screen.getByText("90.000 ₫")).toBeInTheDocument();
  });

  it("shows the resolved variant's price once one is selected by default", () => {
    const cobalt = variant("v1", {
      price: 120000,
      stock: 5,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    render(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt]} />);
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
    render(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt, graphite]} />);
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
    render(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[cobalt]} />);
    const increment = screen.getByRole("button", { name: "Tăng số lượng" });
    await user.click(increment); // 1 -> 2
    expect(increment).toBeDisabled(); // stock is 2, can't go further
  });

  it("shows a sold-out message and disables quantity when the resolved variant has 0 stock", () => {
    const outOfStock = variant("v1", {
      stock: 0,
      optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    });
    render(<ProductPurchasePanel product={baseProduct} options={[colorOption]} variants={[outOfStock]} />);
    expect(screen.getByText(/tạm hết hàng/)).toBeInTheDocument();
  });

  it("never shows a fake success state for add-to-cart — the button stays disabled and says so", () => {
    render(<ProductPurchasePanel product={baseProduct} options={[]} variants={[]} />);
    const addButton = screen.getByRole("button", { name: /Thêm vào giỏ hàng/ });
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/chưa khả dụng/)).toBeInTheDocument();
  });
});
