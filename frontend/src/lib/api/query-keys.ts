export const queryKeys = {
  auth: { me: ["auth", "me"] as const },
  products: {
    all: ["products"] as const,
    list: (filters: Record<string, unknown>) => ["products", "list", filters] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
  },
  orders: {
    all: ["orders"] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  admin: { resource: (name: string) => ["admin", name] as const },
};
