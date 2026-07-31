import { ProductCard } from "@/components/commerce/product-card";
import type { Product } from "@/types/commerce";

export function ProductGrid({ products }: { products: Product[] }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
