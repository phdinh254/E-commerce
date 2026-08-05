import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogProductCard } from "./catalog-product-card";
import type { CatalogProduct } from "@/types/catalog";

function buildProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "prod-1",
    name: "Áo thun basic đen",
    slug: "ao-thun-basic-den",
    sku: "TSHIRT-BASIC-BLACK",
    shortDescription: null,
    description: null,
    price: 150000,
    thumbnailUrl: null,
    isActive: true,
    isFeatured: false,
    category: { id: "cat-1", name: "Áo thun", slug: "ao-thun" },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CatalogProductCard", () => {
  it("renders the product name, category, and formatted price", () => {
    render(<CatalogProductCard product={buildProduct()} />);
    expect(screen.getByText("Áo thun basic đen")).toBeInTheDocument();
    expect(screen.getByText("Áo thun")).toBeInTheDocument();
    expect(screen.getByText(/150\.000/)).toBeInTheDocument();
  });

  it("links to /products/{slug}", () => {
    render(<CatalogProductCard product={buildProduct()} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/products/ao-thun-basic-den");
    }
  });

  it("renders the real thumbnail when present", () => {
    render(
      <CatalogProductCard
        product={buildProduct({ thumbnailUrl: "https://example.com/photo.jpg" })}
      />,
    );
    const img = screen.getByRole("img", { name: "Áo thun basic đen" });
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("falls back to a placeholder (no <img>) when thumbnailUrl is null", () => {
    render(<CatalogProductCard product={buildProduct({ thumbnailUrl: null })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render a category line when category is null", () => {
    render(<CatalogProductCard product={buildProduct({ category: null })} />);
    expect(screen.queryByText("Áo thun")).not.toBeInTheDocument();
  });

  it("never invents a sale price or discount badge (API has none)", () => {
    render(<CatalogProductCard product={buildProduct()} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });
});
