export const queryKeys = {
  auth: { me: ["auth", "me"] as const },
  products: {
    all: ["products"] as const,
    list: (filters: Record<string, unknown>) => ["products", "list", filters] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
    variants: (productId: string) => ["products", "variants", productId] as const,
    images: (productId: string) => ["products", "images", productId] as const,
    options: (productId: string) => ["products", "options", productId] as const,
    attributes: (productId: string) => ["products", "attributes", productId] as const,
    related: (categoryId: string) => ["products", "related", categoryId] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  orders: {
    all: ["orders"] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  cart: {
    detail: ["cart"] as const,
  },
  coupons: {
    featured: (limit?: number) => ["coupons", "featured", limit ?? null] as const,
  },
  payments: {
    status: (orderId: string) => ["payments", "status", orderId] as const,
  },
  addresses: {
    all: ["addresses"] as const,
  },
  admin: { resource: (name: string) => ["admin", name] as const },
};
