import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductInfoTabs } from "./product-info-tabs";
import type { ProductAttribute } from "@/types/product-detail";

function attribute(id: string, overrides: Partial<ProductAttribute> = {}): ProductAttribute {
  return {
    id,
    name: "Kết nối",
    value: "Bluetooth 5.3",
    unit: null,
    displayOrder: 0,
    isVisible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductInfoTabs", () => {
  it("exposes an accessible tablist with two tabs", () => {
    render(<ProductInfoTabs description="Mô tả sản phẩm" attributes={[]} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mô tả" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Thông số kỹ thuật" })).toBeInTheDocument();
  });

  it("renders the description as text (no markup interpretation)", () => {
    render(<ProductInfoTabs description="<b>not bold</b>" attributes={[]} />);
    expect(screen.getByText("<b>not bold</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).not.toBeInTheDocument();
  });

  it("shows a fallback message when description is null", () => {
    render(<ProductInfoTabs description={null} attributes={[]} />);
    expect(screen.getByText("Sản phẩm này chưa có mô tả chi tiết.")).toBeInTheDocument();
  });

  it("switches to the specs tab and renders attribute name/value/unit sorted by displayOrder", async () => {
    const user = userEvent.setup();
    render(
      <ProductInfoTabs
        description="mô tả"
        attributes={[
          attribute("a2", { name: "Khối lượng", value: "268", unit: "g", displayOrder: 1 }),
          attribute("a1", { name: "Kết nối", value: "Bluetooth 5.3", displayOrder: 0 }),
        ]}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Thông số kỹ thuật" }));
    const terms = screen.getAllByRole("term");
    expect(terms.map((el) => el.textContent)).toEqual(["Kết nối", "Khối lượng"]);
    expect(screen.getByText("268 g")).toBeInTheDocument();
  });

  it("shows a fallback message when there are no attributes", async () => {
    const user = userEvent.setup();
    render(<ProductInfoTabs description="mô tả" attributes={[]} />);
    await user.click(screen.getByRole("tab", { name: "Thông số kỹ thuật" }));
    expect(screen.getByText("Sản phẩm này chưa có thông số kỹ thuật.")).toBeInTheDocument();
  });
});
