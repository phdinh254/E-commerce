import { describe, it, expect } from "vitest";
import {
  buildInitialSelection,
  getEffectivePrice,
  getEffectiveStock,
  isValueReachable,
  resolveVariant,
} from "./variant-resolver";
import type { ProductDetail, ProductOption, ProductVariant } from "@/types/product-detail";

const colorOption: ProductOption = {
  id: "opt-color",
  name: "Màu sắc",
  displayOrder: 0,
  values: [
    { id: "val-cobalt", value: "Xanh cobalt", displayOrder: 0 },
    { id: "val-graphite", value: "Xám than", displayOrder: 1 },
  ],
};

const sizeOption: ProductOption = {
  id: "opt-size",
  name: "Kích thước",
  displayOrder: 1,
  values: [
    { id: "val-s", value: "S", displayOrder: 0 },
    { id: "val-m", value: "M", displayOrder: 1 },
  ],
};

function variant(id: string, overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id,
    sku: `SKU-${id}`,
    price: 100000,
    stock: 10,
    isActive: true,
    optionValues: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const cobaltS = variant("v-cobalt-s", {
  price: 100000,
  stock: 5,
  optionValues: [
    { optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" },
    { optionId: "opt-size", optionName: "Kích thước", valueId: "val-s", value: "S" },
  ],
});
const cobaltM = variant("v-cobalt-m", {
  price: 110000,
  stock: 0,
  optionValues: [
    { optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" },
    { optionId: "opt-size", optionName: "Kích thước", valueId: "val-m", value: "M" },
  ],
});
const graphiteS = variant("v-graphite-s", {
  price: 120000,
  stock: 3,
  isActive: false,
  optionValues: [
    { optionId: "opt-color", optionName: "Màu sắc", valueId: "val-graphite", value: "Xám than" },
    { optionId: "opt-size", optionName: "Kích thước", valueId: "val-s", value: "S" },
  ],
});

const allVariants = [cobaltS, cobaltM, graphiteS];

describe("resolveVariant", () => {
  it("resolves the exact variant matching a full selection", () => {
    expect(resolveVariant(allVariants, { "opt-color": "val-cobalt", "opt-size": "val-s" })).toBe(cobaltS);
  });

  it("returns undefined for a partial selection (not every option chosen yet)", () => {
    expect(resolveVariant(allVariants, { "opt-color": "val-cobalt" })).toBeUndefined();
  });

  it("returns undefined for an empty selection", () => {
    expect(resolveVariant(allVariants, {})).toBeUndefined();
  });

  it("resolves by option-value ID, not by display label — two options sharing a label text would not collide", () => {
    // val-s belongs to opt-size; passing it under the wrong optionId must not match.
    expect(resolveVariant(allVariants, { "opt-color": "val-s", "opt-size": "val-cobalt" })).toBeUndefined();
  });

  it("still resolves an inactive variant's combination if explicitly selected (selector disables it separately)", () => {
    expect(resolveVariant(allVariants, { "opt-color": "val-graphite", "opt-size": "val-s" })).toBe(graphiteS);
  });
});

describe("buildInitialSelection", () => {
  it("picks the first active, in-stock variant as the default selection", () => {
    const selection = buildInitialSelection([colorOption, sizeOption], allVariants);
    expect(selection).toEqual({ "opt-color": "val-cobalt", "opt-size": "val-s" });
  });

  it("falls back to the first variant when none are active/in-stock", () => {
    const outOfStockOnly = [
      variant("v1", { stock: 0, optionValues: [{ optionId: "opt-color", optionName: "Màu sắc", valueId: "val-cobalt", value: "Xanh cobalt" }] }),
    ];
    expect(buildInitialSelection([colorOption], outOfStockOnly)).toEqual({ "opt-color": "val-cobalt" });
  });

  it("returns an empty selection when there are no variants at all", () => {
    expect(buildInitialSelection([], [])).toEqual({});
  });
});

describe("isValueReachable", () => {
  it("is true for a value that has at least one active variant given the rest of the selection", () => {
    expect(isValueReachable(allVariants, { "opt-size": "val-s" }, "opt-color", "val-cobalt")).toBe(true);
  });

  it("is false for a value whose only matching variant is inactive", () => {
    expect(isValueReachable(allVariants, { "opt-size": "val-s" }, "opt-color", "val-graphite")).toBe(false);
  });

  it("is true regardless of stock=0 — reachability is about combination existence, not stock", () => {
    expect(isValueReachable(allVariants, { "opt-color": "val-cobalt" }, "opt-size", "val-m")).toBe(true);
  });
});

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

describe("getEffectivePrice", () => {
  it("uses the resolved variant's price when a variant is resolved", () => {
    expect(getEffectivePrice(baseProduct, cobaltS)).toBe(100000);
  });

  it("falls back to the base product price when there is no resolved variant", () => {
    expect(getEffectivePrice(baseProduct, undefined)).toBe(90000);
  });

  it("does not fall back to 0 just because a variant price happens to differ from the product price", () => {
    expect(getEffectivePrice(baseProduct, cobaltM)).toBe(110000);
  });
});

describe("getEffectiveStock", () => {
  it("returns the resolved variant's stock", () => {
    expect(getEffectiveStock(cobaltM)).toBe(0);
  });

  it("returns null (unknown, not 0) when there is no resolved variant", () => {
    expect(getEffectiveStock(undefined)).toBeNull();
  });
});
