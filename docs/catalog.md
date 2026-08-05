# Product Catalog (Chapter 13)

## Route

`/products` is the single canonical catalog route (`frontend/src/app/(store)/products/page.tsx`
→ `components/catalog/catalog-page.tsx`, client-rendered). `/search` is a
server redirect to `/products?q=...` — it does not duplicate the catalog
tree.

## URL search params

| Param | Meaning | Type | Default | Backend mapping |
|---|---|---|---|---|
| `q` | Search keyword | string, trimmed | omitted (`""`) | `search` |
| `category` | Category slug (single) | string | omitted (all categories) | resolved client-side to `categoryId` (UUID) |
| `minPrice` | Minimum price, VND | non-negative integer | omitted | `minPrice` |
| `maxPrice` | Maximum price, VND | non-negative integer | omitted | `maxPrice` |
| `sort` | `price-asc` \| `price-desc` \| `name-asc` \| `name-desc` | enum | omitted ("Mặc định") | `sortBy`+`sortOrder`, or omitted entirely so the backend's own default (relevance-when-searching, `createdAt DESC` otherwise) applies |

Parsing/serialization/validation lives in `frontend/src/lib/catalog/search-params.ts`
(framework-agnostic, unit-tested) and `frontend/src/lib/catalog/use-catalog-filters.ts`
(the Next.js `useSearchParams`/`useRouter` binding — the only place that
touches the URL directly). Invalid values (NaN price, out-of-allowlist
sort, `minPrice > maxPrice`) are dropped, never silently coerced.

History: search-box commits use `router.replace` (debounced, so Back
isn't flooded per keystroke-batch); category/price/sort/clear-filter use
`router.push` (a state worth returning to via Back).

## Pagination model

Real page-number pagination — the backend (`GET /api/v1/products`) returns
`{ items, meta: { page, limit, total, totalPages } }`. The infinite-scroll
hook (`lib/hooks/use-infinite-products.ts`) uses `initialPageParam: 1` and
computes `getNextPageParam` from `meta.page < meta.totalPages`, not from
"did the last page have any items". Page number itself is never reflected
in the URL — only the filters are.

## Backend change made for this chapter

`QueryProductDto` had no price-range filter before Chapter 13 (see the
Chapter 13 report, section N) — `minPrice`/`maxPrice` were added
(validated non-negative integers, `minPrice > maxPrice` rejected with
400), threaded through `ProductsRepository.findMany`, and included in the
product-search Redis cache key so different price filters can't collide
on the same cached page.

## How to run

```bash
# Backend (from backend/, needs Postgres+Redis — see docker-compose.test.yml)
pnpm migration:run
pnpm seed            # Chapter 12 sample data — 10 products, 6 categories
pnpm start:dev        # or: NODE_ENV=test node dist/main.js after `pnpm build`

# Frontend (from frontend/)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm dev
```

Test commands:

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test            # vitest — unit + integration (no E2E framework in this repo)
pnpm build
```

`KHÔNG TỒN TẠI TRONG REPOSITORY`: there is no Playwright/Cypress/other E2E
framework installed — Chapter 13's E2E section is marked CHƯA KIỂM CHỨNG
in the final report; real backend integration was instead verified via a
running dev server + headless Chrome screenshots (see report section L).

## Known pre-existing, out-of-scope items

- The global announcement bar / header overflows horizontally at very
  narrow widths (≤375px) — present on `/` (home) too, so it predates this
  chapter and lives in `components/layout/*`, not the catalog components.
- `/products/[slug]` (product detail) and the home page's featured
  section still render `@/lib/data/mock-data.ts` — out of Chapter 13's
  scope (only the listing/search experience). A real `CatalogProductCard`
  links to `/products/{slug}` for forward-compatibility, but that route
  will 404 for a real (non-mock) product slug until a future chapter
  wires it to the real product-detail API.
