import { redirect } from "next/navigation";

// `/products` is the single canonical catalog route (see
// components/catalog/catalog-page.tsx) — it already supports `q` via the
// same URL-driven filter state Ch13-B117 defines, so `/search` is kept
// only as a redirect for any existing inbound links rather than
// duplicating the catalog implementation.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
}
