import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CartItem } from "./cart-item";
import type { CartItem as CartItemType } from "@/types/cart";

const BASE_ITEM: CartItemType = {
  itemId: "i1",
  productId: "p1",
  variantId: null,
  productName: "Tai nghe Bluetooth",
  slug: "tai-nghe-bluetooth",
  sku: "SKU-1",
  image: null,
  selectedOptions: null,
  quantity: 2,
  unitPrice: 100_000,
  lineTotal: 200_000,
  available: true,
  unavailableReason: null,
};

describe("CartItem", () => {
  it("renders product name, price, and quantity", () => {
    render(
      <CartItem item={BASE_ITEM} onQuantityChange={vi.fn()} onRemove={vi.fn()} isUpdating={false} isRemoving={false} />,
    );

    expect(screen.getByText("Tai nghe Bluetooth")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Số lượng" }).length).toBeGreaterThan(0);
  });

  it("calls onQuantityChange when the increase button is clicked", () => {
    const onQuantityChange = vi.fn();
    render(
      <CartItem item={BASE_ITEM} onQuantityChange={onQuantityChange} onRemove={vi.fn()} isUpdating={false} isRemoving={false} />,
    );

    const increaseButtons = screen.getAllByRole("button", { name: "Tăng số lượng" });
    fireEvent.click(increaseButtons[0]);

    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it("calls onRemove when the delete button is clicked, and it has an accessible name", () => {
    const onRemove = vi.fn();
    render(
      <CartItem item={BASE_ITEM} onQuantityChange={vi.fn()} onRemove={onRemove} isUpdating={false} isRemoving={false} />,
    );

    const removeButton = screen.getByRole("button", { name: /xóa tai nghe bluetooth khỏi giỏ hàng/i });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables quantity and remove controls while pending", () => {
    render(
      <CartItem item={BASE_ITEM} onQuantityChange={vi.fn()} onRemove={vi.fn()} isUpdating={true} isRemoving={false} />,
    );

    const removeButton = screen.getByRole("button", { name: /xóa tai nghe bluetooth khỏi giỏ hàng/i });
    expect(removeButton).toBeDisabled();
  });

  it("shows the unavailable reason and caps quantity increase at the current quantity", () => {
    const item: CartItemType = { ...BASE_ITEM, available: false, unavailableReason: "Sản phẩm không còn hoạt động" };
    render(
      <CartItem item={item} onQuantityChange={vi.fn()} onRemove={vi.fn()} isUpdating={false} isRemoving={false} />,
    );

    expect(screen.getByText("Sản phẩm không còn hoạt động")).toBeInTheDocument();
    const increaseButtons = screen.getAllByRole("button", { name: "Tăng số lượng" });
    expect(increaseButtons[0]).toBeDisabled(); // max === current quantity
  });

  it("does not nest an interactive button inside the product link", () => {
    const { container } = render(
      <CartItem item={BASE_ITEM} onQuantityChange={vi.fn()} onRemove={vi.fn()} isUpdating={false} isRemoving={false} />,
    );

    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.querySelector("button")).toBeNull();
    });
  });
});
