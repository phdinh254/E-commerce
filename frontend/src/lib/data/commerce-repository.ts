import { adminRows, mockAddresses, mockCategories, mockOrders, mockProducts } from "@/lib/data/mock-data";
import type { Address, AdminTableRow, Category, Order, Product } from "@/types/commerce";

export interface ProductFilters {
  query?: string;
  category?: string;
  inStock?: boolean;
}

// TODO(api): Replace each mock branch when its backend endpoint exists.
// Pages depend on this boundary, so swapping to API data does not require UI rewrites.
export const commerceRepository = {
  async getProducts(filters: ProductFilters = {}): Promise<Product[]> {
    const query = filters.query?.trim().toLocaleLowerCase("vi");
    return mockProducts.filter((product) => {
      const matchesQuery = !query || [product.name, product.brand, product.category].some((value) => value.toLocaleLowerCase("vi").includes(query));
      const matchesCategory = !filters.category || product.categorySlug === filters.category;
      const matchesStock = !filters.inStock || product.stock > 0;
      return matchesQuery && matchesCategory && matchesStock;
    });
  },
  async getProduct(slug: string): Promise<Product | undefined> {
    return mockProducts.find((product) => product.slug === slug);
  },
  async getCategories(): Promise<Category[]> {
    return mockCategories;
  },
  async getOrders(): Promise<Order[]> {
    return mockOrders;
  },
  async getOrder(id: string): Promise<Order | undefined> {
    return mockOrders.find((order) => order.id === id);
  },
  async getAddresses(): Promise<Address[]> {
    return mockAddresses;
  },
  async getAdminRows(resource: string): Promise<AdminTableRow[]> {
    return adminRows[resource] ?? [];
  },
};

export const commerceDataSource = {
  auth: "api" as const,
  health: "api" as const,
  catalog: "mock" as const,
  cart: "mock" as const,
  checkout: "mock" as const,
  orders: "mock" as const,
  admin: "mock" as const,
};
