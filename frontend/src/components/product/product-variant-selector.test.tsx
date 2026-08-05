import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductVariantSelector } from "./product-variant-selector";
import type { ProductOption, ProductVariant } from "@/types/product-detail";

const colorOption: ProductOption = {
  id: "opt-color",
  name: "Màu sắc",
  displayOrder: 0,
  values: [
    { id: "val-cobalt", value: "Xanh cobalt", displayOrder: 0 },
    { id: "val-graphite", value: "Xám than", displayOrder: 1 },
  ],
};

const variants: ProductVariant[] = [
  {
    id: "v1",
    sku: "SKU1",
    price: 100000,
    stock: 5,
    isActive: true,
    optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("ProductVariantSelector", () => {
  it("renders a fieldset with a legend per option", () => {
    render(
      <ProductVariantSelector options={[colorOption]} variants={variants} selection={{}} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: "Màu sắc" })).toBeInTheDocument();
  });

  it("disables a value that has no reachable active variant", () => {
    render(
      <ProductVariantSelector options={[colorOption]} variants={variants} selection={{}} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Xám than/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Xanh cobalt/ })).toBeEnabled();
  });

  it("calls onSelect with the option ID and value ID, not the label text", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ProductVariantSelector options={[colorOption]} variants={variants} selection={{}} onSelect={onSelect} />,
    );
    await user.click(screen.getByRole("button", { name: /Xanh cobalt/ }));
    expect(onSelect).toHaveBeenCalledWith("opt-color", "val-cobalt");
  });

  it("marks the currently selected value with aria-pressed", () => {
    render(
      <ProductVariantSelector
        options={[colorOption]}
        variants={variants}
        selection={{ "opt-color": "val-cobalt" }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Xanh cobalt/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders nothing when the product has no options", () => {
    const { container } = render(
      <ProductVariantSelector options={[]} variants={[]} selection={{}} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
