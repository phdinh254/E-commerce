# Product Detail Page (Chapter 14)

## Route

`/products/[slug]` (`frontend/src/app/(store)/products/[slug]/page.tsx`) —
an async Server Component that calls `productsApi.getBySlug` once for
`generateMetadata` (SEO title/description), then renders the client
component `components/product/product-detail-view.tsx`, which is the real
source of truth for the page body (loading/error/notFound states, data).
No `generateStaticParams`/SSG anymore — the old version pre-generated pages
for `@/lib/data/mock-data.ts`'s hardcoded slugs; that mock data source is
gone from this route.

The metadata fetch and the client view's own fetch are two separate GET
requests for the same product. This repo has no dehydrate/hydrate boundary
set up (Chapter 13's `CatalogPage` is plain client-rendered with no SSR
hydration either — see `docs/catalog.md`), so this keeps the same
established pattern rather than introducing new SSR/hydration
infrastructure as a side effect of Chapter 14.

## Backend endpoints used (all pre-existing, public, unmodified)

| Endpoint | DTO | Used for |
|---|---|---|
| `GET /products/slug/:slug` | `ProductResponseDto` | base product (name, price, description, category, thumbnail) |
| `GET /products/:productId/variants` | `ProductVariantResponseDto[]` | active variants (sku, price, stock, option values) |
| `GET /products/:productId/options` | `ProductOptionResponseDto[]` | option/value definitions for the selector's labels |
| `GET /products/:productId/images` | `ProductImageResponseDto[]` | gallery images (signed URL, altText, displayOrder, optional variantId) |
| `GET /products/:productId/attributes` | `ProductAttributeResponseDto[]` | "specifications" tab content (already filtered to `isVisible`) |
| `GET /products?categoryId=…` | `PaginatedProductResponseDto` | related products, server-filtered |

No backend code changed for Chapter 14 — every field the frontend renders
comes from a DTO field that already existed. `frontend/src/types/product-detail.ts`
mirrors these DTOs 1:1; no invented fields (no rating, brand, stockStatus —
none of which exist on any backend entity).

Five requests total for one page view (product, then the three dependent
resources plus, further down, related products) — not a per-item fetch
inside a list, so this does not reintroduce the N+1 pattern Chapter 13
avoided in the catalog grid.

## Variant selection and resolution

`lib/product/variant-resolver.ts` (pure functions, unit-tested):

- `resolveVariant(variants, selection)` — resolves strictly by option-value
  **ID**, never by display label text, and only when the selection is
  "complete" (every option assigned) — never guesses a variant from a
  partial pick.
- `buildInitialSelection` — defaults to the first active, in-stock variant.
- `isValueReachable` — disables a value button when no *active* variant
  carries it (independent of stock — a reachable-but-sold-out combination
  still renders, just later shown as sold out).
- `getEffectivePrice` / `getEffectiveStock` — variant price/stock win once
  resolved; base product price is only a fallback for the (rare, but real)
  case of a product with zero option/variants at all. Stock is `null`
  (unknown), never fabricated as `0` or `Infinity`, when nothing is
  resolved yet.

`lib/product/gallery-images.ts` — `selectGalleryImages` prefers the
selected variant's own images (sorted by `displayOrder`); falls back to
product-level images (`variantId === null`) only when the variant has none
of its own; never mixes the two once the variant has any.

## Gallery

`components/product/product-gallery.tsx` — plain `<img>`, not
`next/image`: image URLs are freshly-signed, short-lived URLs from a
private bucket with no fixed host to allowlist in `next.config`'s
`images.remotePatterns` (same reasoning as `CatalogProductCard`, Ch13).
Thumbnails are an accessible `role="tablist"`/`role="tab"` group;
`aria-selected` marks the active one; alt text is the image's own
`altText` when present, else a numbered fallback built from the product
name. Only the single active/main image is `loading="eager"` +
`fetchPriority="high"` — thumbnails stay `loading="lazy"`.

## Quantity and add-to-cart (Ch14-B132) — BỊ CHẶN for persistence

**Audit finding:** there is no Cart module anywhere in
`backend/src/modules` (searched for `cart`/`Cart` repo-wide — the only
hits are unrelated: `coupons`, and the `guest` module's claim-handling
interfaces, which are generic guest-session infrastructure with no cart
concept wired to them yet).

Building a Cart module from scratch was in scope per the task's own
fallback clause, but was not attempted end-to-end in this session because:

1. No Postgres/Redis is reachable in this environment (`docker ps` shows no
   containers; `docker-compose.yml` defines them but nothing is running) —
   a new entity/migration could not be run or verified, and shipping an
   unverified migration is worse than not shipping one.
2. Real business decisions this task cannot make unilaterally: guest cart
   TTL/merge-on-login policy beyond the existing generic guest-session
   claim mechanism, an idempotency-key convention for the add-to-cart
   endpoint, and whether stock is re-validated at add-time, checkout-time,
   or both.

**What is real and shipped:** `components/product/product-purchase-panel.tsx`
resolves the selected variant, shows its real price, and renders a fully
functional, validated `QuantitySelector` (reused from `components/commerce/`)
capped at the resolved variant's real stock (or a documented default of 99
when the product has no variants — see the code comment on
`getEffectiveStock`, since the base `Product` entity itself has no stock
column). The "Thêm vào giỏ hàng" button is **disabled** with a `title` and
a visible inline explanation. No `localStorage`, no fake success toast, no
client-side-only "cart" — per the task's explicit prohibition on
mock/fake persistence.

## Description / specifications tabs (Ch14-B133)

`components/product/product-info-tabs.tsx` uses the existing
`components/ui/tabs.tsx` (base-ui `Tabs` primitive — accessible
tablist/tab/tabpanel roles and arrow-key navigation built in, not
hand-rolled). Description renders as plain text
(`whitespace-pre-line`), **not** `dangerouslySetInnerHTML` — the backend
stores `description` as a plain `text` column, not sanitized HTML.
Specifications come from `GET /products/:productId/attributes`
(name/value/unit, sorted by `displayOrder`); the backend's `listPublic`
already filters to `isVisible`.

## Related products (Ch14-B134)

`components/product/related-products.tsx` +
`lib/hooks/use-related-products.ts` — one real, server-filtered
`GET /products?categoryId=…` request (not the whole catalog filtered
client-side, not `Math.random()` sampling), excludes the current product,
caps at 4, and reuses `CatalogProductCard` (Chapter 13) rather than a new
card component.

## Known gaps / explicitly not done

- **Cart persistence** — BỊ CHẶN, see above.
- **Playwright/visual QA at 375×812 / 768×1024 / 1440×900** — CHƯA KIỂM
  CHỨNG. There is no E2E framework in this repo (same limitation Chapter
  13 recorded) and no way to launch a real browser against a running dev
  server plus a live backend (Postgres/Redis not running) in this
  environment. Verification here is limited to: `tsc --noEmit`, `eslint`,
  `vitest run` (full suite), and `next build`.
- **Backend unit/e2e tests** — not applicable; no backend code was
  changed for Chapter 14 (see "Backend endpoints used" above).

## How to run

```bash
# Backend (from backend/, needs Postgres+Redis)
pnpm migration:run
pnpm seed
pnpm start:dev

# Frontend (from frontend/)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm dev
# then open /products/<a real seeded slug>
```

Test commands:

```bash
cd frontend
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec eslint src/components/product src/lib/product src/lib/api src/lib/hooks
pnpm exec vitest run
pnpm exec next build
```
