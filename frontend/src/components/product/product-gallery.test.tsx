import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "./product-gallery";
import type { ProductImage } from "@/types/product-detail";

function image(id: string, overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id,
    productId: "p1",
    variantId: null,
    url: `https://signed.example/${id}.jpg`,
    urlExpiresInSeconds: 3600,
    mimeType: "image/webp",
    sizeBytes: 1000,
    altText: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductGallery", () => {
  it("shows an empty-state icon (not a broken image) when there are no images", () => {
    render(<ProductGallery images={[]} productName="Tai nghe Aura One" />);
    expect(screen.getByLabelText("Tai nghe Aura One, chưa có ảnh")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the first image as the main image and falls back to the product name as alt text", () => {
    render(<ProductGallery images={[image("a")]} productName="Tai nghe Aura One" />);
    expect(screen.getByAltText("Tai nghe Aura One")).toBeInTheDocument();
  });

  it("uses altText when the image has one, not the generic product name", () => {
    render(<ProductGallery images={[image("a", { altText: "Mặt trước màu xanh cobalt" })]} productName="Tai nghe" />);
    // With a single image the thumbnail and main image both carry the same
    // altText — assert there's no leftover generic "Tai nghe" alt anywhere.
    expect(screen.getAllByAltText("Mặt trước màu xanh cobalt").length).toBeGreaterThan(0);
    expect(screen.queryByAltText("Tai nghe")).not.toBeInTheDocument();
  });

  it("clicking a thumbnail swaps the main image", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        images={[image("a", { altText: "Ảnh A" }), image("b", { altText: "Ảnh B" })]}
        productName="Tai nghe"
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Xem ảnh 2/ }));
    // Both the now-active thumbnail and the main image show "Ảnh B" —
    // assert the main (eagerly-loaded) image specifically.
    const mainImage = screen.getAllByAltText("Ảnh B").find((el) => el.getAttribute("loading") === "eager");
    expect(mainImage).toBeDefined();
  });

  it("marks the active thumbnail with aria-selected", () => {
    render(<ProductGallery images={[image("a"), image("b")]} productName="Tai nghe" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });
});
