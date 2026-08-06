import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "./client";
import { cartApi } from "./cart";

afterEach(() => {
  vi.restoreAllMocks();
});

const CART = {
  cartId: "cart-1",
  items: [],
  totalQuantity: 0,
  subtotal: 0,
  currency: "VND" as const,
  updatedAt: null,
};

describe("cartApi.getCart", () => {
  it("calls GET /cart and returns the response data", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: CART });

    const result = await cartApi.getCart();

    expect(get).toHaveBeenCalledWith("/cart", { signal: undefined });
    expect(result).toBe(CART);
  });

  it("forwards the AbortSignal", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: CART });
    const controller = new AbortController();

    await cartApi.getCart(controller.signal);

    expect(get).toHaveBeenCalledWith("/cart", { signal: controller.signal });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("network down"));
    await expect(cartApi.getCart()).rejects.toThrow("network down");
  });
});

describe("cartApi.addItem", () => {
  it("posts to /cart/items with the Idempotency-Key header and no extra fields", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: CART });

    await cartApi.addItem({ productId: "p1", quantity: 2 }, "key-1");

    expect(post).toHaveBeenCalledWith(
      "/cart/items",
      { productId: "p1", quantity: 2 },
      { headers: { "Idempotency-Key": "key-1" } },
    );
  });

  it("never includes a price or userId field in the payload", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: CART });

    await cartApi.addItem({ productId: "p1", variantId: "v1", quantity: 1 }, "key-2");

    const [, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("userId");
    expect(body).toEqual({ productId: "p1", variantId: "v1", quantity: 1 });
  });

  it("does not swallow errors", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("conflict"));
    await expect(
      cartApi.addItem({ productId: "p1", quantity: 1 }, "key-3"),
    ).rejects.toThrow("conflict");
  });
});

describe("cartApi.updateItemQuantity", () => {
  it("sends an absolute quantity via PATCH, not a delta", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({ data: CART });

    await cartApi.updateItemQuantity("item-1", 5);

    expect(patch).toHaveBeenCalledWith("/cart/items/item-1", { quantity: 5 });
  });

  it("encodes the itemId path segment", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({ data: CART });

    await cartApi.updateItemQuantity("a/b", 1);

    expect(patch).toHaveBeenCalledWith(`/cart/items/${encodeURIComponent("a/b")}`, {
      quantity: 1,
    });
  });
});

describe("cartApi.removeItem", () => {
  it("calls DELETE /cart/items/:itemId", async () => {
    const del = vi.spyOn(apiClient, "delete").mockResolvedValue({ data: undefined });

    await cartApi.removeItem("item-1");

    expect(del).toHaveBeenCalledWith("/cart/items/item-1");
  });
});
