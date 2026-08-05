# Seed Strategy (Chapter 12)

## Migration vs. seed vs. fixture vs. factory vs. bootstrap

| Term | Purpose | Where |
|---|---|---|
| Migration | Creates/changes schema (tables, columns, constraints) | `src/database/migrations/*.ts`, run via `pnpm migration:run` |
| Seed | Populates development/test/demo databases with sample data | `src/database/seeds/*` (this document) |
| Fixture | Data for one specific test case | inline in `*.spec.ts` / `*.e2e-spec.ts` |
| Factory | Builds an in-memory object for a test (never touches the DB by itself) | `build*()` helper functions already used throughout `*.spec.ts` files |
| Production bootstrap | Minimal system data actually required at boot (none exists in this repo beyond `seed:admin`, which is unrelated to this chapter) | `src/database/seeds/admin.seed.ts` |

Chapter 12's `seed.ts` is squarely in the "seed" column — sample data for
local development, demo, and test database initialization. It is never
run in production (see the environment guard below) and it is not a
migration: no schema change belongs in `seed.ts`, and no dev-only sample
data belongs in a migration.

## Where this fits with the pre-existing `seed:admin`

`src/database/seeds/admin.seed.ts` already existed before Chapter 12 —
a single-purpose script that creates one ADMIN user from
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. It is untouched by this
chapter. The new `seed.ts` also seeds a demo ADMIN user (from
`users.json`), reusing the same `SEED_ADMIN_PASSWORD` env var so the two
scripts don't produce two different admin passwords — but they use
independent natural keys (whatever email is in `users.json` vs.
`SEED_ADMIN_EMAIL`), so running either or both is safe and idempotent;
neither can create a duplicate of the other's row.

## Environments

`seed.ts` refuses to run when `NODE_ENV=production`. There is no
separate "staging" allowance in this repository — if a real staging
environment is introduced later, it must opt in explicitly (not be
silently permitted by omission).

`reset.ts` (Ch12-B115) is stricter: it requires **all four** of
`NODE_ENV ∈ {development, test}`, `ALLOW_DATABASE_RESET=true`, a
`--confirm-reset` CLI flag, and the target database name being present in
`DB_RESET_ALLOWLIST` — simultaneously. See
`src/database/seeds/helpers/reset-guard.ts`.

## Determinism

- No `faker` (or any random-data library) is used. The dependency isn't
  installed, and every field that matters for identity or a business rule
  — email, slug, SKU, coupon code, option/value names, quantities, prices,
  dates — is a literal, hand-written value in the JSON fixtures under
  `src/database/seeds/data/`. This keeps `git diff` on the fixtures
  meaningful and every seed run byte-for-byte reproducible.
- Natural keys, not hard-coded UUIDs: `email` (users), `slug` (categories,
  products), `sku` (products, variants — table-wide unique, matching
  `UQ_product_variants_sku_upper`), `code` (coupons — matching
  `UQ_coupons_code_upper`), `(productId, normalizedName)` (options,
  attributes). Every seeder resolves foreign keys by looking up these
  natural keys against what the database (or the current run) actually
  produced — never by assuming a fixed ID or row order.
- Coupon dates are fixed ISO timestamps in `coupons.json`
  (`2025-01-01T00:00:00.000Z` → `2030-12-31T23:59:59.000Z`), not
  `new Date()` — so "is this coupon currently valid" doesn't silently flip
  between seed runs years apart. One coupon (`VIPONLY`) demonstrates the
  "not currently usable" case via `isActive: false`, not via an already-
  expired date range.

## Directory layout

```
src/database/seeds/
  data/            JSON fixtures (one file per entity type)
  assets/          Shared binary image fixtures (placeholder-1.jpg/2.png/3.webp)
  dto/             class-validator DTOs — one per JSON file's record shape
  helpers/         readFromFile, cross-file validation, reset guard, storage provider builder
  seeders/         one function per entity type, each takes an EntityManager
  seed.ts          orchestrator (entrypoint)
  reset.ts         guarded destructive reset (+ optional --then-seed)
  admin.seed.ts    pre-existing, unrelated, untouched
```

No ORM other than TypeORM is introduced. No new validation library is
introduced — `class-validator`/`class-transformer` (already a dependency,
already used by every DTO in `src/modules/**`) is reused for both
per-file schema validation and, indirectly, cross-file validation.

## Idempotency

Every seeder looks up its natural key first; if found, it updates a
bounded set of "demo content" fields (never re-hashing passwords, never
re-creating variant/option join rows, never bumping `usedCount`); if not
found, it inserts. Running `pnpm seed` twice in a row produces identical
row counts on the second run (every seeder reports 0 created / N updated)
— verified in `test/seed.e2e-spec.ts`.

## Transaction boundaries

Three separate transactions/steps, not one all-encompassing transaction,
because Supabase Storage calls (network I/O) must never happen while a
PostgreSQL transaction is held open (the same rule Chapter 11 already
established for the runtime upload endpoints):

1. **Core transaction** — users → categories → products → options →
   variants. Pure DB, no network. All-or-nothing: any failure rolls back
   the entire group.
2. **Images** — outside any long-lived transaction. Each image is
   validated, uploaded to Storage, then inserted in its own short
   transaction with local compensation (delete the just-uploaded object)
   if that single insert fails. If Supabase isn't configured, this step
   is skipped entirely (not faked — see the Storage section below).
3. **Tail transaction** — attributes → coupons. Pure DB, no network,
   independent all-or-nothing group.

**Residual risk of this split**: if step 2 or 3 fails, the rows already
committed in step 1 (and any images already committed within step 2) are
**not** rolled back. This is an intentional, documented relaxation
(explicitly permitted when "seeding toàn chương trong một transaction
không phù hợp" — see Ch12-B109's brief) rather than an oversight: because
every step here is idempotent by natural key, the fix for a partial
failure is simply "read the error, fix the data, run `pnpm seed` again" —
it will not create duplicates from what already committed.

## Supabase Storage for seed images

Policy **A** ("seed dùng asset local và upload vào bucket
development/test") is followed when Supabase is configured; the seeder
falls back to a clean **skip** (not a fake success) when it is not —
there is no real Supabase project/credential available in this
environment (see the Chapter 11 report for the same constraint).

- Object path is **deterministic**, not the random-UUID scheme the
  Chapter 11 runtime upload endpoint uses:
  `seed/products/{productSlug}/{product|variant-<sku>}-{n}.{ext}`. This
  is what makes image seeding idempotent — `product_images` is checked
  for an existing `(storageBucket, objectPath)` row before ever calling
  `upload()`.
- The `seed/` prefix is the manifest: `reset.ts`'s Storage cleanup step
  queries `product_images` for rows whose `object_path LIKE 'seed/%'`
  and removes exactly those Supabase objects — never a bucket-wide list,
  never anything a real user uploaded through the Chapter 11 endpoints.
- `upsert: false` is still respected (inherited from
  `SupabaseStorageProvider`) — a re-run either finds the DB row first and
  skips, or uploads to a path that has never been used, never both
  writing over an existing object.

## How to run

Prerequisite: PostgreSQL + Redis reachable per `.env`/`.env.test`
(`docker compose -f docker-compose.test.yml up -d` for the test stack),
and migrations applied (`pnpm migration:run`).

```bash
# Validate seed JSON files only — no database connection.
pnpm seed:validate

# Seed (development uses .env, NODE_ENV=test uses .env.test — see seed.ts).
pnpm seed

# Re-running is safe — natural-key upsert, no duplicates.
pnpm seed

# DESTRUCTIVE — only in development/test, only with every guard satisfied.
# See src/database/seeds/helpers/reset-guard.ts.
ALLOW_DATABASE_RESET=true pnpm db:reset -- --confirm-reset

# Reset then immediately reseed.
ALLOW_DATABASE_RESET=true pnpm db:reset:seed -- --confirm-reset
```

`ALLOW_DATABASE_RESET=true` and `DB_RESET_ALLOWLIST=<database name>` must
both be set in the environment (`.env.test` already sets both for
`ecommerce_test`; `.env.example` documents them as `false`/empty —
opt-in only).

### Demo accounts created by `pnpm seed`

| Email | Role | Password source |
|---|---|---|
| `admin.demo@example.local` | ADMIN | `SEED_ADMIN_PASSWORD` |
| `customer.one@example.local` | CUSTOMER | `SEED_DEFAULT_PASSWORD` |
| `customer.two@example.local` | CUSTOMER | `SEED_DEFAULT_PASSWORD` |
| `customer.three@example.local` | CUSTOMER | `SEED_DEFAULT_PASSWORD` |

Never hard-coded — both env vars are required (the script fails fast if
either is unset) and are never printed/logged.

### Supabase fixture images

If `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_STORAGE_BUCKET`
are not configured, `pnpm seed` prints a warning and skips product-image
seeding entirely (every other step still runs) — this is the case in
this repository's current environment (no Supabase test project exists
here; see the Chapter 11 report). When they ARE configured, images
upload under the `seed/` object-path prefix and `db:reset` cleans up
exactly those objects (never a bucket-wide delete) before dropping the
schema.

## What Chapter 12 does not do

No Cart/Checkout/Order/Payment/Shipment/Review seeding, no Elasticsearch
reindexing, no email/notification sending, no PayOS calls, no Redis key
seeding (cache is left to populate itself on first read, same as any
other cache-miss), no `FLUSHALL`, no admin UI.
