import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { Container } from "@/components/layout/container";
import { CatalogProductGridSkeleton } from "@/components/catalog/catalog-states";

export const metadata: Metadata = {
  title: "Sản phẩm",
  description: "Khám phá những thiết bị công nghệ và sản phẩm phong cách sống được tuyển chọn kỹ lưỡng.",
};

// `CatalogPage` reads the URL via `useSearchParams()` (see
// lib/catalog/use-catalog-filters.ts) — Next.js requires a Suspense
// boundary around any client component using that hook so the route can
// still be statically shelled instead of opting the whole page out of
// static rendering.
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-8 sm:py-10 lg:py-12">
          <CatalogProductGridSkeleton />
        </Container>
      }
    >
      <CatalogPage />
    </Suspense>
  );
}
