# Chapter 19 — Order Management End-to-End — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task's implementer MUST also read `docs/superpowers/plans/2026-08-07-chapter-19-order-management.md#audit-facts` before starting — it documents exact existing code this plan builds on. Follow TDD (superpowers:test-driven-development) for every task with a Test file listed.

**Goal:** Ship customer order list/detail/cancel, a real status-history + admin transition service, transactional order emails, and a real (non-mock) frontend order account experience, on top of the existing checkout/payment system in `D:\DU-AN\E-commerce`.

**Architecture:** Order = the existing `OrderEntity` (cart-is-order pattern, table `orders`). Add fulfillment states to `OrderStatus`, add item/history actor snapshots via migration, introduce one `OrderTransitionService` as the single place that mutates `Order.status` (used by admin-update, cancel, and refactored-in-place by checkout/webhook where safe without touching their transaction shape), one `OrderHistoryService` for append-only history writes, and a `MailService`-queue-backed order-email flow. Frontend gets a real `orders.ts` API service + TanStack Query hooks replacing the existing mock-driven account/orders pages.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend), Next.js + TanStack Query + axios (frontend), Jest (backend tests), Vitest (frontend tests), BullMQ (mail queue).

## Global Constraints

- Reuse `apiClient` axios instance (`frontend/src/lib/api/client.ts`) — no second HTTP client.
- Reuse `CartRepository`-style `DataSource.transaction` + `.setLock('pessimistic_write')` pattern — no new locking mechanism, no `version` column invented.
- Reuse `GlobalExceptionFilter` error contract: throw `new ConflictException({code, message})` / `BadRequestException({code, message})` / `ForbiddenException({code, message})` — never a second error envelope.
- Reuse `QueryProductDto`/`PaginatedProductResponseDto` pagination shape for order list.
- Reuse `@Roles`, `RolesGuard`, `@CurrentUser()` — never trust `userId`/`role`/`status`/`total`/`paymentStatus` from request body or query.
- Reuse BullMQ `EmailProcessor` + `EmailJobName` pattern for all order emails — no direct SMTP calls in request path, no second queue.
- Reuse `queryKeys.orders.all` / `queryKeys.orders.detail(id)` stubs already in `frontend/src/lib/api/query-keys.ts`; add `orders.lists()`/`orders.list(filters)` alongside them.
- Reuse `AccountNav`, `confirm-dialog.tsx`, `status-badge.tsx` on the frontend — do not recreate.
- Money stays integer VND end-to-end. No floats.
- No inventory-release code — no inventory module exists in this repo; do not invent one.
- No PayOS refund integration — cancellation of a `PAID` order is out of scope; return a stable `ORDER_REFUND_REQUIRED` error instead.
- Customer self-cancel is allowed only while `Order.status === PENDING_PAYMENT` (see audit note above — COD orders start at `PAID` and are therefore not self-cancellable).
- Never push. Never run `git add -A`/`git add .`. Never commit `.env`.

## Audit Facts

(Reference only — do not re-derive, use these exact facts.)

- `OrderEntity`: `backend/src/modules/cart/entities/order.entity.ts`, table `orders`. Fields incl. `status`, `subtotalAmount`, `discountAmount`, `totalAmount` (all integer VND), coupon snapshot fields, `shippingRecipientName/PhoneNumber/Province/District/Ward/StreetAddress/Note`, `placedAt`. No `orderNumber`, no `version`.
- `OrderStatus` enum: `backend/src/modules/cart/enums/order-status.enum.ts` → `CART | PENDING_PAYMENT | PAID | CANCELLED` only.
- `OrderItemEntity`: `backend/src/modules/cart/entities/order-item.entity.ts` — `unitPriceAmount` (integer, snapshot), `quantity`, live `productId`/`variantId` FK (`onDelete: 'RESTRICT'`). No name/sku/image snapshot columns.
- `OrderStatusHistoryEntity`: `backend/src/modules/cart/entities/order-status-history.entity.ts`, table `order_status_histories` — `orderId, fromStatus, toStatus, changedBy (uuid, nullable), reason (varchar 500, nullable), createdAt`. Currently inserted ad hoc via `manager.getRepository(OrderStatusHistoryEntity).insert(...)` inline in `checkout.service.ts` / payment transition code.
- `PaymentEntity`/`PaymentStatus`: `backend/src/modules/payments/` — `PENDING | PAID | CANCELLED | EXPIRED | FAILED`. `PaymentTransitionService.applyProviderStatus` / `finalizeOrderPaid` is the single source of truth for payment transitions (webhook + sync call it). Do not bypass it.
- Checkout: `backend/src/modules/checkout/checkout.service.ts`. COD → single transaction, `Order.status = PAID` directly, `Payment` created `PAID`, coupon redeemed inline, history inserted inline. PayOS → TX1 sets `Order.status = PENDING_PAYMENT` + `Payment PENDING`, commits, then calls gateway; webhook/sync flips to `PAID` via `PaymentTransitionService`.
- Idempotency: `IdempotencyKeyEntity` (`cart/entities/idempotency-key.entity.ts`), keyed `(userId, operation, idempotencyKey)`, via `IdempotencyRepository`.
- No `orders` controller exists. Only `checkout.controller.ts` (`POST /checkout/cod`, `POST /checkout/payos`) and `payments.controller.ts` (`GET /orders/:orderId/payment-status`).
- RBAC: `@Roles(...UserRole[])` (`common/decorators/roles.decorator.ts`) + `RolesGuard` on `request.user.role`; `UserRole = CUSTOMER | ADMIN`. `@CurrentUser()` returns `AuthenticatedUser` from `request.user`.
- Errors: `GlobalExceptionFilter` (`common/filters/http-exception.filter.ts`) maps `HttpException` body `{code, message}` → `ErrorResponseDto`.
- Pagination: `QueryProductDto` (`page`/`limit`, `@Type(() => Number)`, default 1/20 max 100) + `PaginatedProductResponseDto {data, page, limit, total, totalPages}`.
- Mail: `MailService` (`infrastructure/mail/mail.service.ts`, nodemailer) + BullMQ `EmailProcessor` (`infrastructure/queue/email.processor.ts`) keyed by `EmailJobName`. Only `SEND_WELCOME_EMAIL` exists today.
- Transactions: `CartRepository.runInTransaction` wraps `DataSource.transaction`; pessimistic locks via `.setLock('pessimistic_write')` (see `lockActiveCartWithItemsForUser`). No optimistic `version` column anywhere — pessimistic lock is the established mechanism.
- Migrations: `backend/src/database/migrations/`, timestamp-prefixed classes, raw SQL `up`/`down` via `queryRunner.query`. Latest existing timestamp: `1739400000000`. Scripts: `pnpm typeorm` wrapper — `migration:generate`, `migration:run`, `migration:revert`, `migration:show`.
- Tests: Jest; e2e via `jest --config ./test/jest-e2e.json` + `.env.test`. Existing order/payment e2e: `backend/test/checkout-payment.e2e-spec.ts`. `docker-compose.test.yml` exists at repo root — availability must be checked live, not assumed.
- Frontend `account/orders` pages (`frontend/src/app/(store)/account/orders/page.tsx`, `[id]/page.tsx`) exist but are mock-driven via `commerceRepository.getOrders()` — full rewrite needed, not a patch. `AccountNav` (`components/commerce/account-nav.tsx`) already has the "Đơn hàng của tôi" nav item wired — reuse as-is.
- `frontend/src/lib/api/query-keys.ts` already reserves `orders.all` / `orders.detail(id)`, no `orders.list(filters)` factory yet. No `frontend/src/lib/api/orders.ts` service file exists.
- `apiClient` (`frontend/src/lib/api/client.ts`) — axios, bearer token in-memory + refresh-on-401, `withCredentials: true`. `getApiErrorMessage()` for error mapping.
- Design system: `components/feedback/confirm-dialog.tsx` (AlertDialog wrapper, reuse for cancel), `components/commerce/status-badge.tsx` (status→label/color, extend not duplicate).
- Ch18 hook convention to mimic: `lib/hooks/use-addresses.ts`, `use-profile.ts`, paired `.test.tsx` files.
- Logout cache clear: `lib/auth/auth-provider.tsx` + `lib/api/auth.ts` — verify/wire `queryClient.clear()` on logout if not already present.

## Order State Machine (source of truth for this chapter)

| From | To | Actor | Side effects | History | Email |
|---|---|---|---|---|---|
| `PENDING_PAYMENT` | `PAID` | SYSTEM (webhook/sync via `PaymentTransitionService`) | coupon redeem (existing) | yes (existing, keep) | order confirmation (paid) |
| `PENDING_PAYMENT` | `CANCELLED` | CUSTOMER (self-cancel) or SYSTEM (payment expiry, out of scope this chapter) | none (no inventory module) | yes | cancellation |
| `PAID` | `CONFIRMED` | ADMIN | none | yes | status update |
| `CONFIRMED` | `PROCESSING` | ADMIN | none | yes | status update |
| `PROCESSING` | `SHIPPED` | ADMIN | none | yes | status update |
| `SHIPPED` | `DELIVERED` | ADMIN | none | yes | status update |
| `PAID`/`CONFIRMED`/`PROCESSING`/`SHIPPED`/`DELIVERED` | `CANCELLED` | — | **not allowed** (`ORDER_REFUND_REQUIRED`) | — | — |
| `CANCELLED`, `DELIVERED` | * | — | terminal, no transition allowed | — | — |

`CART` is pre-order (not yet placed) and out of scope for all Ch19 endpoints — order list/detail must filter `status != CART`.

Full new `OrderStatus` enum: `CART, PENDING_PAYMENT, PAID, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED`.

`OrderActorType` enum (new): `CUSTOMER, ADMIN, SYSTEM`.

---

## File Structure

Backend (new/modified):
- `backend/src/database/migrations/1754500000000-AddOrderFulfillmentStatuses.ts` — extends `OrderStatus` enum column, adds `actor_type`/`actor_id` to `order_status_histories` (replacing bare `changedBy`), adds `product_name`/`sku`/`image_url` snapshot columns to `order_items`.
- `backend/src/modules/cart/enums/order-status.enum.ts` — modify, add `CONFIRMED, PROCESSING, SHIPPED, DELIVERED`.
- `backend/src/modules/cart/enums/order-actor-type.enum.ts` — create.
- `backend/src/modules/cart/entities/order-status-history.entity.ts` — modify, add `actorType`, rename usage of `changedBy` → `actorId`.
- `backend/src/modules/cart/entities/order-item.entity.ts` — modify, add `productNameSnapshot`, `skuSnapshot`, `imageUrlSnapshot`.
- `backend/src/modules/checkout/checkout.service.ts` — modify: populate item snapshot columns at order finalization (both COD and PayOS paths); replace inline history insert with `OrderHistoryService.record(...)` call inside the same transaction manager.
- `backend/src/modules/payments/payment-transition.service.ts` — modify: replace inline history insert with `OrderHistoryService.record(...)`; enqueue paid-confirmation email after commit.
- `backend/src/modules/orders/orders.module.ts` — create.
- `backend/src/modules/orders/entities/` — none new (reuses cart module entities via TypeORM feature import).
- `backend/src/modules/orders/order-history.service.ts` — create (Bài 190).
- `backend/src/modules/orders/order-transition.service.ts` — create (Bài 190/191/192 shared state machine + cancel).
- `backend/src/modules/orders/orders.controller.ts` — create (Bài 188/189/192 customer endpoints).
- `backend/src/modules/orders/admin-orders.controller.ts` — create (Bài 191 admin endpoint).
- `backend/src/modules/orders/dto/query-orders.dto.ts` — create.
- `backend/src/modules/orders/dto/order-summary-response.dto.ts` — create.
- `backend/src/modules/orders/dto/order-detail-response.dto.ts` — create.
- `backend/src/modules/orders/dto/order-history-response.dto.ts` — create.
- `backend/src/modules/orders/dto/cancel-order.dto.ts` — create.
- `backend/src/modules/orders/dto/admin-update-order-status.dto.ts` — create.
- `backend/src/modules/orders/order-errors.ts` — create (stable error codes/messages).
- `backend/src/infrastructure/queue/email-job-name.enum.ts` — modify, add `SEND_ORDER_CONFIRMATION_EMAIL`, `SEND_ORDER_STATUS_UPDATE_EMAIL`.
- `backend/src/infrastructure/queue/email.processor.ts` — modify, add the two new job cases.
- `backend/src/infrastructure/mail/templates/order-confirmation.template.ts` — create.
- `backend/src/infrastructure/mail/templates/order-status-update.template.ts` — create.
- `backend/src/modules/orders/order-notification.service.ts` — create (Bài 193/194 — enqueue policy + idempotent job id).
- `backend/src/app.module.ts` — modify, register `OrdersModule`.
- Tests: `backend/src/modules/orders/*.spec.ts` (unit), `backend/test/orders.e2e-spec.ts` (new e2e), `backend/test/orders-cancellation.e2e-spec.ts` (new e2e, concurrency).

Frontend (new/modified):
- `frontend/src/lib/api/orders.ts` — create (Bài 195 service).
- `frontend/src/lib/api/query-keys.ts` — modify, add `orders.lists()` / `orders.list(filters)`.
- `frontend/src/lib/types/order.ts` — create (DTO types mirroring backend response shape).
- `frontend/src/lib/hooks/use-orders.ts` — create.
- `frontend/src/lib/hooks/use-order.ts` — create.
- `frontend/src/lib/hooks/use-cancel-order.ts` — create.
- `frontend/src/lib/hooks/order-status-labels.ts` — create (single source for status label/style, used by list, detail, timeline).
- `frontend/src/app/(store)/account/orders/page.tsx` — rewrite (Bài 196), real API.
- `frontend/src/app/(store)/account/orders/[id]/page.tsx` — rewrite (Bài 197), real API + timeline.
- `frontend/src/components/commerce/order-card.tsx` — create.
- `frontend/src/components/commerce/order-timeline.tsx` — create.
- `frontend/src/components/commerce/cancel-order-dialog.tsx` — create (Bài 198, built on `confirm-dialog.tsx`).
- `frontend/src/components/commerce/status-badge.tsx` — modify, extend mapping for new statuses if needed.
- `frontend/src/lib/auth/auth-provider.tsx` — modify only if `queryClient.clear()` on logout is missing.
- Tests: `frontend/src/lib/api/orders.test.ts`, `frontend/src/lib/hooks/use-orders.test.tsx`, `use-order.test.tsx`, `use-cancel-order.test.tsx`, `frontend/src/app/(store)/account/orders/page.test.tsx`, `[id]/page.test.tsx`, `cancel-order-dialog.test.tsx`.

---

## Task 1: Migration — fulfillment statuses, history actor, item snapshot

**Files:**
- Create: `backend/src/database/migrations/1754500000000-AddOrderFulfillmentStatuses.ts`
- Modify: `backend/src/modules/cart/enums/order-status.enum.ts`
- Create: `backend/src/modules/cart/enums/order-actor-type.enum.ts`
- Modify: `backend/src/modules/cart/entities/order-status-history.entity.ts`
- Modify: `backend/src/modules/cart/entities/order-item.entity.ts`
- Test: `backend/test/migrations.e2e-spec.ts` (or extend existing migration smoke test if one exists — check `backend/test/` first)

**Interfaces:**
- Produces: `OrderStatus` = `CART | PENDING_PAYMENT | PAID | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED`.
- Produces: `OrderActorType` = `CUSTOMER | ADMIN | SYSTEM`.
- Produces: `OrderStatusHistoryEntity.actorType: OrderActorType`, `.actorId: string | null` (renamed from `changedBy`).
- Produces: `OrderItemEntity.productNameSnapshot: string`, `.skuSnapshot: string`, `.imageUrlSnapshot: string | null`.

- [ ] **Step 1: Inspect current enum column type**

Run: `grep -n "status" backend/src/database/migrations/*.ts | grep -i order` and read the migration that originally created `orders`/`order_status_histories`/`order_items` to confirm whether `status` is a Postgres native enum (`CREATE TYPE ... AS ENUM`) or a `varchar` with `CHECK` constraint. This determines whether the migration needs `ALTER TYPE ... ADD VALUE` (native enum, cannot run inside the same transaction as other DDL in old Postgres — must be a standalone statement) or a `CHECK` constraint drop/recreate.

- [ ] **Step 2: Write migration `up`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderFulfillmentStatuses1754500000000 implements MigrationInterface {
  name = 'AddOrderFulfillmentStatuses1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adjust to native-enum or CHECK-constraint form based on Step 1 finding.
    // Native enum example:
    await queryRunner.query(`ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'CONFIRMED'`);
    await queryRunner.query(`ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSING'`);
    await queryRunner.query(`ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'SHIPPED'`);
    await queryRunner.query(`ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'DELIVERED'`);

    await queryRunner.query(`
      CREATE TYPE "order_status_histories_actor_type_enum" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM')
    `);
    await queryRunner.query(`
      ALTER TABLE "order_status_histories"
      ADD COLUMN "actor_type" "order_status_histories_actor_type_enum" NOT NULL DEFAULT 'SYSTEM'
    `);
    await queryRunner.query(`
      ALTER TABLE "order_status_histories" RENAME COLUMN "changed_by" TO "actor_id"
    `);
    await queryRunner.query(`ALTER TABLE "order_status_histories" ALTER COLUMN "actor_type" DROP DEFAULT`);

    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN "product_name_snapshot" varchar(255) NOT NULL DEFAULT '',
      ADD COLUMN "sku_snapshot" varchar(100) NOT NULL DEFAULT '',
      ADD COLUMN "image_url_snapshot" varchar(1024) NULL
    `);
    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "product_name_snapshot" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "sku_snapshot" DROP DEFAULT`);

    // Backfill existing order_items snapshot from current product/variant data —
    // best-effort only, documented as historical approximation, not fabricated new events.
    await queryRunner.query(`
      UPDATE "order_items" oi
      SET "product_name_snapshot" = p."name",
          "sku_snapshot" = COALESCE(pv."sku", p."sku", '')
      FROM "products" p
      LEFT JOIN "product_variants" pv ON pv."id" = oi."variant_id"
      WHERE oi."product_id" = p."id"
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_order_status_histories_order_id_created_at"
      ON "order_status_histories" ("order_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_status_histories_order_id_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "order_items"
      DROP COLUMN "product_name_snapshot",
      DROP COLUMN "sku_snapshot",
      DROP COLUMN "image_url_snapshot"
    `);
    await queryRunner.query(`ALTER TABLE "order_status_histories" RENAME COLUMN "actor_id" TO "changed_by"`);
    await queryRunner.query(`ALTER TABLE "order_status_histories" DROP COLUMN "actor_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_histories_actor_type_enum"`);
    // Note: Postgres cannot drop enum values; down() intentionally leaves the four
    // added OrderStatus enum values in place (documented, non-destructive no-op for that part).
  }
}
```

Adjust exact enum/table/column names to match what Step 1 found — the block above is the shape, not verbatim-guaranteed identifiers.

- [ ] **Step 3: Update entities/enums to match**

`order-status.enum.ts`: add the four new values.
`order-actor-type.enum.ts`: new file exporting `OrderActorType`.
`order-status-history.entity.ts`: rename `changedBy` column/property to `actorId`, add `actorType: OrderActorType` column.
`order-item.entity.ts`: add `productNameSnapshot`, `skuSnapshot`, `imageUrlSnapshot` columns.

- [ ] **Step 4: Run migration up/down/up against test DB**

Run: `docker compose -f docker-compose.test.yml up -d` (if not already running), then from `backend/`: `pnpm typeorm migration:run`, `pnpm typeorm migration:revert`, `pnpm typeorm migration:run`. Record exact output. If Postgres is unavailable, mark this step CHƯA KIỂM CHỨNG and continue — do not block later tasks on it, but do not claim it passed.

- [ ] **Step 5: Fix any compile errors from renamed `changedBy` references**

Run: `cd backend && pnpm build` and `grep -rn "changedBy" backend/src` — update every call site (checkout.service.ts, payment-transition.service.ts) to the new `actorId`/`actorType` shape (these call sites get properly refactored in Task 2, but must at least compile here).

- [ ] **Step 6: Commit**

```bash
git add backend/src/database/migrations/1754500000000-AddOrderFulfillmentStatuses.ts backend/src/modules/cart/enums/order-status.enum.ts backend/src/modules/cart/enums/order-actor-type.enum.ts backend/src/modules/cart/entities/order-status-history.entity.ts backend/src/modules/cart/entities/order-item.entity.ts
git commit -m "feat(orders): add fulfillment statuses, history actor type, item snapshot columns"
```

---

## Task 2: Order History Service (Bài 190)

**Files:**
- Create: `backend/src/modules/orders/order-history.service.ts`
- Create: `backend/src/modules/orders/dto/order-history-response.dto.ts`
- Modify: `backend/src/modules/checkout/checkout.service.ts` (replace inline history insert)
- Modify: `backend/src/modules/payments/payment-transition.service.ts` (replace inline history insert)
- Test: `backend/src/modules/orders/order-history.service.spec.ts`

**Interfaces:**
- Produces: `OrderHistoryService.record(manager: EntityManager, params: { orderId: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; actorType: OrderActorType; actorId: string | null; reason?: string }): Promise<OrderStatusHistoryEntity>` — must be called with the same `manager` as the surrounding transaction (never opens its own transaction).
- Produces: `OrderHistoryService.listCustomerSafe(orderId: string): Promise<OrderHistoryEntryDto[]>`.
- Consumes: `OrderStatusHistoryEntity`, `OrderActorType` from Task 1.

- [ ] **Step 1: Write failing unit test for `record`**

```typescript
// order-history.service.spec.ts
it('inserts exactly one history row using the caller-supplied manager', async () => {
  const manager = dataSource.createEntityManager();
  await dataSource.transaction(async (txManager) => {
    await service.record(txManager, {
      orderId: order.id,
      fromStatus: OrderStatus.PENDING_PAYMENT,
      toStatus: OrderStatus.PAID,
      actorType: OrderActorType.SYSTEM,
      actorId: null,
    });
  });
  const rows = await manager.getRepository(OrderStatusHistoryEntity).find({ where: { orderId: order.id } });
  expect(rows).toHaveLength(1);
  expect(rows[0].toStatus).toBe(OrderStatus.PAID);
});

it('rolls back the history row when the enclosing transaction rolls back', async () => {
  await expect(dataSource.transaction(async (txManager) => {
    await service.record(txManager, { orderId: order.id, fromStatus: null, toStatus: OrderStatus.PAID, actorType: OrderActorType.SYSTEM, actorId: null });
    throw new Error('force rollback');
  })).rejects.toThrow();
  const rows = await dataSource.getRepository(OrderStatusHistoryEntity).find({ where: { orderId: order.id } });
  expect(rows).toHaveLength(0);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd backend && pnpm test order-history.service.spec.ts` — expect FAIL (`service` undefined / module not found).

- [ ] **Step 3: Implement `OrderHistoryService`**

```typescript
@Injectable()
export class OrderHistoryService {
  async record(manager: EntityManager, params: {
    orderId: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    actorType: OrderActorType;
    actorId: string | null;
    reason?: string;
  }): Promise<OrderStatusHistoryEntity> {
    const repo = manager.getRepository(OrderStatusHistoryEntity);
    return repo.save(repo.create({
      orderId: params.orderId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      actorType: params.actorType,
      actorId: params.actorId,
      reason: params.reason?.slice(0, 500) ?? null,
    }));
  }

  async listCustomerSafe(orderId: string): Promise<OrderHistoryEntryDto[]> {
    const rows = await this.dataSource.getRepository(OrderStatusHistoryEntity).find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      toStatus: row.toStatus,
      createdAt: row.createdAt,
      reason: row.actorType === OrderActorType.CUSTOMER || row.actorType === OrderActorType.SYSTEM ? row.reason : null,
    }));
  }
}
```

Customer-safe mapping drops `actorId` and `fromStatus` entirely from the DTO (spec: no internal Admin UUID/email leakage) and only exposes admin `reason` text if it's a customer-safe field — since there's no separate internal-note column yet, treat all `reason` as customer-safe for now (documented assumption) but never expose `actorId`.

- [ ] **Step 4: Run test, verify it passes**

Run: `cd backend && pnpm test order-history.service.spec.ts` — expect PASS.

- [ ] **Step 5: Replace inline history inserts in checkout.service.ts and payment-transition.service.ts**

Find every `manager.getRepository(OrderStatusHistoryEntity).insert(...)` call (grep confirmed these exist inline). Replace each with `this.orderHistoryService.record(manager, {...})`, injecting `OrderHistoryService` via constructor, keeping the exact same transaction manager passed through. Set `actorType: OrderActorType.SYSTEM, actorId: null` for both the COD-placement and PayOS-webhook-confirmation call sites (no human actor initiates these).

- [ ] **Step 6: Run existing checkout/payment tests to confirm no regression**

Run: `cd backend && pnpm test checkout` and `pnpm test payment` — expect all PASS (same behavior, refactored call site only).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/orders/order-history.service.ts backend/src/modules/orders/dto/order-history-response.dto.ts backend/src/modules/checkout/checkout.service.ts backend/src/modules/payments/payment-transition.service.ts
git commit -m "feat(orders): extract order status history into a dedicated append-only service"
```

---

## Task 3: Order Transition Service — state machine core (Bài 190/191/192 shared)

**Files:**
- Create: `backend/src/modules/orders/order-transition.service.ts`
- Create: `backend/src/modules/orders/order-errors.ts`
- Test: `backend/src/modules/orders/order-transition.service.spec.ts`

**Interfaces:**
- Produces: `ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]>` — single source of truth table matching the "Order State Machine" section above.
- Produces: `OrderTransitionService.adminTransition(orderId: string, actor: AuthenticatedUser, toStatus: OrderStatus, reason?: string): Promise<OrderEntity>`.
- Produces: `OrderTransitionService.cancelByCustomer(orderId: string, userId: string, reason?: string): Promise<OrderEntity>`.
- Consumes: `OrderHistoryService.record` (Task 2), `CartRepository`-style locking pattern, `DataSource` (TypeORM).
- Consumes error codes from `order-errors.ts`: `ORDER_NOT_FOUND`, `ORDER_ACCESS_DENIED`, `ORDER_TRANSITION_NOT_ALLOWED`, `ORDER_ALREADY_CANCELLED`, `ORDER_CANCELLATION_NOT_ALLOWED`, `ORDER_ALREADY_PAID`/`ORDER_REFUND_REQUIRED`, `ORDER_CONCURRENT_MODIFICATION`.

- [ ] **Step 1: Write `order-errors.ts`**

```typescript
export const ORDER_ERROR_CODES = {
  NOT_FOUND: 'ORDER_NOT_FOUND',
  ACCESS_DENIED: 'ORDER_ACCESS_DENIED',
  STATUS_INVALID: 'ORDER_STATUS_INVALID',
  TRANSITION_NOT_ALLOWED: 'ORDER_TRANSITION_NOT_ALLOWED',
  ALREADY_CANCELLED: 'ORDER_ALREADY_CANCELLED',
  CANCELLATION_NOT_ALLOWED: 'ORDER_CANCELLATION_NOT_ALLOWED',
  REFUND_REQUIRED: 'ORDER_REFUND_REQUIRED',
  CONCURRENT_MODIFICATION: 'ORDER_CONCURRENT_MODIFICATION',
  FILTER_INVALID: 'ORDER_FILTER_INVALID',
} as const;

export function orderNotFound() {
  return new NotFoundException({ code: ORDER_ERROR_CODES.NOT_FOUND, message: 'Order not found' });
}
export function orderTransitionNotAllowed(from: OrderStatus, to: OrderStatus) {
  return new ConflictException({ code: ORDER_ERROR_CODES.TRANSITION_NOT_ALLOWED, message: `Cannot transition order from ${from} to ${to}` });
}
export function orderAlreadyCancelled() {
  return new ConflictException({ code: ORDER_ERROR_CODES.ALREADY_CANCELLED, message: 'Order is already cancelled' });
}
export function orderRefundRequired() {
  return new ConflictException({ code: ORDER_ERROR_CODES.REFUND_REQUIRED, message: 'Order is already paid; cancellation requires a refund workflow' });
}
```

(NOT_FOUND used for both truly-missing and not-owned-by-this-user, per existing Address ownership 404 policy — confirm this policy by reading `backend/src/modules/addresses/*.service.ts` ownership check before finalizing; match it exactly.)

- [ ] **Step 2: Write failing tests for the transition table and admin transition**

```typescript
describe('ORDER_TRANSITIONS table', () => {
  it('allows PAID -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.PAID]).toContain(OrderStatus.CONFIRMED);
    expect(ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toContain(OrderStatus.PROCESSING);
    expect(ORDER_TRANSITIONS[OrderStatus.PROCESSING]).toContain(OrderStatus.SHIPPED);
    expect(ORDER_TRANSITIONS[OrderStatus.SHIPPED]).toContain(OrderStatus.DELIVERED);
  });
  it('has no outgoing transitions from DELIVERED or CANCELLED', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });
  it('does not allow skipping PROCESSING (PAID -> SHIPPED)', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.PAID]).not.toContain(OrderStatus.SHIPPED);
  });
});

describe('adminTransition', () => {
  it('moves PAID order to CONFIRMED and records ADMIN-actor history in one transaction', async () => {
    const order = await createPaidOrderFixture();
    const result = await service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED);
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    const history = await historyRepo.find({ where: { orderId: order.id }, order: { createdAt: 'DESC' } });
    expect(history[0].toStatus).toBe(OrderStatus.CONFIRMED);
    expect(history[0].actorType).toBe(OrderActorType.ADMIN);
    expect(history[0].actorId).toBe(adminUser.id);
  });

  it('rejects PAID -> SHIPPED with ORDER_TRANSITION_NOT_ALLOWED (409)', async () => {
    const order = await createPaidOrderFixture();
    await expect(service.adminTransition(order.id, adminUser, OrderStatus.SHIPPED))
      .rejects.toMatchObject({ status: 409, response: { code: 'ORDER_TRANSITION_NOT_ALLOWED' } });
  });

  it('rejects transition from terminal DELIVERED', async () => {
    const order = await createDeliveredOrderFixture();
    await expect(service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED)).rejects.toThrow();
  });

  it('locks the order row before deciding the transition (concurrent admin calls yield exactly one success)', async () => {
    const order = await createPaidOrderFixture();
    const results = await Promise.allSettled([
      service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
      service.adminTransition(order.id, adminUser, OrderStatus.CONFIRMED),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const historyCount = await historyRepo.count({ where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED } });
    expect(historyCount).toBe(1); // exactly one history row regardless of how many calls "succeeded" idempotently
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd backend && pnpm test order-transition.service.spec.ts` — expect FAIL (module not found).

- [ ] **Step 4: Implement `ORDER_TRANSITIONS` and `OrderTransitionService.adminTransition`**

```typescript
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CART]: [],
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderHistoryService: OrderHistoryService,
    private readonly orderNotificationService: OrderNotificationService,
  ) {}

  async adminTransition(orderId: string, actor: AuthenticatedUser, toStatus: OrderStatus, reason?: string): Promise<OrderEntity> {
    const order = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrderEntity);
      const current = await repo.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.status === OrderStatus.CART) throw orderNotFound();
      const allowed = ORDER_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(toStatus)) throw orderTransitionNotAllowed(current.status, toStatus);

      const fromStatus = current.status;
      current.status = toStatus;
      const saved = await repo.save(current);
      await this.orderHistoryService.record(manager, {
        orderId, fromStatus, toStatus, actorType: OrderActorType.ADMIN, actorId: actor.id, reason,
      });
      return saved;
    });

    await this.orderNotificationService.notifyStatusChangeIfNeeded(order.id, toStatus);
    return order;
  }
}
```

Note the row lock (`lock: { mode: 'pessimistic_write' }`) is acquired before reading `current.status`, matching `CartRepository`'s pattern — this is what makes the concurrent-call test yield exactly one history row: the second transaction blocks until the first commits, then re-reads the now-`CONFIRMED` status and gets `ORDER_TRANSITION_NOT_ALLOWED` (or, if idempotent-retry-to-same-status is desired, returns the current order without a new history row — decide via Step 4a below).

- [ ] **Step 4a: Decide and implement idempotent same-status retry**

Add: if `current.status === toStatus` already (retry of the exact same transition), return the current order without writing new history or throwing — per spec §5/§10 "Request idempotent hoặc retry phải không tạo history trùng." Add a test for this exact case and implement it as the first check inside the transaction, before the `allowed.includes` check.

- [ ] **Step 5: Run tests, verify pass**

Run: `cd backend && pnpm test order-transition.service.spec.ts` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/order-transition.service.ts backend/src/modules/orders/order-errors.ts backend/src/modules/orders/order-transition.service.spec.ts
git commit -m "feat(orders): add order transition state machine with admin transition"
```

---

## Task 4: Customer Cancellation (Bài 192)

**Files:**
- Modify: `backend/src/modules/orders/order-transition.service.ts` (add `cancelByCustomer`)
- Modify: `backend/src/modules/coupons/coupons.service.ts` (add rollback method — audit found none exists)
- Test: `backend/src/modules/orders/order-transition.service.spec.ts` (extend)

**Interfaces:**
- Produces: `OrderTransitionService.cancelByCustomer(orderId: string, userId: string, reason?: string): Promise<OrderEntity>`.
- Produces: `CouponsService.rollbackRedemption(manager: EntityManager, orderId: string): Promise<void>` — deletes the redemption row for this order (if any) and decrements `usedCount` by exactly 1, guarded so a second call is a no-op (check redemption row exists before decrementing).
- Consumes: `ORDER_TRANSITIONS`, `OrderHistoryService.record`, `orderRefundRequired()`, `orderAlreadyCancelled()`.

- [ ] **Step 1: Write failing tests**

```typescript
describe('cancelByCustomer', () => {
  it('cancels own PENDING_PAYMENT order and records CUSTOMER-actor history', async () => {
    const order = await createPendingPaymentOrderFixture(customerUser.id);
    const result = await service.cancelByCustomer(order.id, customerUser.id, 'Changed my mind');
    expect(result.status).toBe(OrderStatus.CANCELLED);
    const history = await historyRepo.findOne({ where: { orderId: order.id }, order: { createdAt: 'DESC' } });
    expect(history.actorType).toBe(OrderActorType.CUSTOMER);
    expect(history.actorId).toBe(customerUser.id);
  });

  it('rejects cancelling another user\'s order with ORDER_NOT_FOUND (404, anti-enumeration)', async () => {
    const order = await createPendingPaymentOrderFixture(otherUser.id);
    await expect(service.cancelByCustomer(order.id, customerUser.id)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects cancelling a PAID order with ORDER_REFUND_REQUIRED (409)', async () => {
    const order = await createPaidOrderFixture(customerUser.id); // COD path lands here directly
    await expect(service.cancelByCustomer(order.id, customerUser.id)).rejects.toMatchObject({ status: 409, response: { code: 'ORDER_REFUND_REQUIRED' } });
  });

  it('rejects cancelling CONFIRMED/PROCESSING/SHIPPED/DELIVERED orders', async () => {
    for (const status of [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]) {
      const order = await createOrderInStatusFixture(customerUser.id, status);
      await expect(service.cancelByCustomer(order.id, customerUser.id)).rejects.toThrow();
    }
  });

  it('cancel retry after success is idempotent: no duplicate history, no error', async () => {
    const order = await createPendingPaymentOrderFixture(customerUser.id);
    await service.cancelByCustomer(order.id, customerUser.id);
    const second = await service.cancelByCustomer(order.id, customerUser.id);
    expect(second.status).toBe(OrderStatus.CANCELLED);
    const count = await historyRepo.count({ where: { orderId: order.id, toStatus: OrderStatus.CANCELLED } });
    expect(count).toBe(1);
  });

  it('rolls back coupon usage exactly once on cancellation, even on retry', async () => {
    const order = await createPendingPaymentOrderWithCouponFixture(customerUser.id, couponCode);
    await service.cancelByCustomer(order.id, customerUser.id);
    await service.cancelByCustomer(order.id, customerUser.id); // retry
    const coupon = await couponsRepo.findOne({ where: { code: couponCode } });
    expect(coupon.usedCount).toBe(originalUsedCount); // decremented exactly once, not twice
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd backend && pnpm test order-transition.service.spec.ts -t cancelByCustomer` — expect FAIL.

- [ ] **Step 3: Implement `CouponsService.rollbackRedemption`**

Read `backend/src/modules/coupons/coupons.service.ts` `redeemForOrder` first to mirror its exact redemption-row shape, then add the inverse:

```typescript
async rollbackRedemption(manager: EntityManager, orderId: string): Promise<void> {
  const redemptionRepo = manager.getRepository(CouponRedemptionEntity);
  const redemption = await redemptionRepo.findOne({ where: { orderId } });
  if (!redemption) return; // idempotent no-op — nothing to roll back
  await redemptionRepo.delete({ orderId });
  await manager.getRepository(CouponEntity).decrement({ id: redemption.couponId }, 'usedCount', 1);
}
```

- [ ] **Step 4: Implement `cancelByCustomer`**

```typescript
async cancelByCustomer(orderId: string, userId: string, reason?: string): Promise<OrderEntity> {
  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(OrderEntity);
    const order = await repo.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
    if (!order || order.userId !== userId || order.status === OrderStatus.CART) throw orderNotFound();

    if (order.status === OrderStatus.CANCELLED) return order; // idempotent retry, no new history

    if (order.status !== OrderStatus.PENDING_PAYMENT) throw orderRefundRequired();

    const fromStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    const saved = await repo.save(order);

    await this.couponsService.rollbackRedemption(manager, orderId);
    await this.orderHistoryService.record(manager, {
      orderId, fromStatus, toStatus: OrderStatus.CANCELLED, actorType: OrderActorType.CUSTOMER, actorId: userId,
      reason: reason?.slice(0, 500),
    });
    return saved;
  }).then(async (order) => {
    await this.orderNotificationService.notifyCancellation(order.id);
    return order;
  });
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd backend && pnpm test order-transition.service.spec.ts` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/order-transition.service.ts backend/src/modules/coupons/coupons.service.ts
git commit -m "feat(orders): add transactional customer cancellation with coupon rollback"
```

---

## Task 5: Order List + Detail Endpoints (Bài 188/189)

**Files:**
- Create: `backend/src/modules/orders/orders.controller.ts`
- Create: `backend/src/modules/orders/orders.service.ts` (read-only query service, separate from transition service)
- Create: `backend/src/modules/orders/dto/query-orders.dto.ts`
- Create: `backend/src/modules/orders/dto/order-summary-response.dto.ts`
- Create: `backend/src/modules/orders/dto/order-detail-response.dto.ts`
- Create: `backend/src/modules/orders/orders.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/modules/orders/orders.service.spec.ts`
- Test: `backend/test/orders.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/v1/orders` (guards: JWT required) — query: `page, limit, status?, sortBy?, sortOrder?` → `PaginatedOrderSummaryResponseDto`.
- Produces: `GET /api/v1/orders/:orderId` (guards: JWT required) → `OrderDetailResponseDto`, 404 if not found or not owned.
- Consumes: `OrderHistoryService.listCustomerSafe` (Task 2), `ORDER_ERROR_CODES`.

- [ ] **Step 1: Write failing service tests for list scoping and pagination**

```typescript
describe('OrdersService.listForUser', () => {
  it('only returns orders belonging to the given user', async () => {
    await createPaidOrderFixture(userA.id);
    await createPaidOrderFixture(userB.id);
    const result = await service.listForUser(userA.id, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].userId).toBeUndefined(); // DTO must not leak userId at all
  });

  it('excludes CART-status rows', async () => {
    await createCartFixture(userA.id); // not yet checked out
    const result = await service.listForUser(userA.id, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(0);
  });

  it('filters by status', async () => {
    await createPaidOrderFixture(userA.id);
    await createCancelledOrderFixture(userA.id);
    const result = await service.listForUser(userA.id, { page: 1, limit: 20, status: OrderStatus.CANCELLED });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe(OrderStatus.CANCELLED);
  });

  it('sorts deterministically by createdAt DESC with id tie-breaker by default', async () => {
    const result = await service.listForUser(userA.id, { page: 1, limit: 20 });
    const dates = result.data.map((o) => o.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('paginates correctly (page 2 of 3, limit 1)', async () => {
    // create 3 orders, request page 2 limit 1, expect exactly the 2nd-newest
  });
});

describe('OrdersService.getDetailForUser', () => {
  it('returns 404-shaped error for another user\'s order', async () => {
    const order = await createPaidOrderFixture(userB.id);
    await expect(service.getDetailForUser(order.id, userA.id)).rejects.toMatchObject({ status: 404 });
  });

  it('returns item snapshot fields, not live product data', async () => {
    const order = await createPaidOrderFixture(userA.id);
    await productsRepo.update(order.items[0].productId, { name: 'RENAMED AFTER ORDER' });
    const detail = await service.getDetailForUser(order.id, userA.id);
    expect(detail.items[0].productName).not.toBe('RENAMED AFTER ORDER');
  });

  it('returns shipping snapshot even after the source Address is deleted', async () => {
    const order = await createPaidOrderFixture(userA.id);
    await addressesRepo.delete(sourceAddressId);
    const detail = await service.getDetailForUser(order.id, userA.id);
    expect(detail.shippingAddress.recipientName).toBeDefined();
  });

  it('includes customer-safe history', async () => {
    const order = await createPaidOrderFixture(userA.id);
    const detail = await service.getDetailForUser(order.id, userA.id);
    expect(detail.history.length).toBeGreaterThan(0);
    expect(detail.history[0]).not.toHaveProperty('actorId');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && pnpm test orders.service.spec.ts` — expect FAIL (module not found).

- [ ] **Step 3: Implement `QueryOrdersDto`**

```typescript
export class QueryOrdersDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit: number = 20;
  @IsEnum(OrderStatus) @IsOptional() status?: OrderStatus;
  @IsIn(['createdAt', 'totalAmount']) @IsOptional() sortBy: 'createdAt' | 'totalAmount' = 'createdAt';
  @IsIn(['ASC', 'DESC']) @IsOptional() sortOrder: 'ASC' | 'DESC' = 'DESC';
}
```

Mirror the exact decorator style used in `QueryProductDto` — read that file first and match conventions (global-pipe validation error → `ORDER_FILTER_INVALID` mapping, confirm via existing `ValidationPipe` exceptionFactory).

- [ ] **Step 4: Implement `OrdersService.listForUser` and `getDetailForUser`**

```typescript
async listForUser(userId: string, query: QueryOrdersDto): Promise<PaginatedOrderSummaryResponseDto> {
  const qb = this.orderRepo.createQueryBuilder('o')
    .leftJoinAndSelect('o.items', 'items')
    .where('o.userId = :userId', { userId })
    .andWhere('o.status != :cart', { cart: OrderStatus.CART });
  if (query.status) qb.andWhere('o.status = :status', { status: query.status });
  qb.orderBy(`o.${query.sortBy}`, query.sortOrder).addOrderBy('o.id', 'ASC')
    .skip((query.page - 1) * query.limit).take(query.limit);
  const [rows, total] = await qb.getManyAndCount();
  return {
    data: rows.map(toOrderSummaryDto),
    page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit),
  };
}

async getDetailForUser(orderId: string, userId: string): Promise<OrderDetailResponseDto> {
  const order = await this.orderRepo.findOne({ where: { id: orderId, userId, status: Not(OrderStatus.CART) }, relations: ['items'] });
  if (!order) throw orderNotFound();
  const history = await this.orderHistoryService.listCustomerSafe(orderId);
  return toOrderDetailDto(order, history);
}
```

`toOrderSummaryDto`/`toOrderDetailDto` are explicit mapping functions (or DTO `static fromEntity`) that whitelist fields — never `return order` raw, never spread the entity.

- [ ] **Step 5: Implement controller**

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.listForUser(user.id, query);
  }

  @Get(':orderId')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.getDetailForUser(orderId, user.id);
  }
}
```

Match the exact guard name/import used elsewhere (`JwtAuthGuard` — confirm exact name via `grep -rn "UseGuards" backend/src/modules/checkout`).

- [ ] **Step 6: Wire `OrdersModule` into `app.module.ts`, run tests**

Run: `cd backend && pnpm test orders.service.spec.ts` — expect PASS. Run: `cd backend && pnpm build` — expect success.

- [ ] **Step 7: Write and run e2e test**

```typescript
// backend/test/orders.e2e-spec.ts
it('GET /orders returns 401 for guest', () => request(app).get('/api/v1/orders').expect(401));
it('GET /orders returns only the authenticated user\'s orders', async () => { /* ... */ });
it('GET /orders/:id returns 404 for another user\'s order', async () => { /* ... */ });
```

Run: `cd backend && pnpm test:e2e orders.e2e-spec.ts` if Postgres test DB is up; otherwise mark CHƯA KIỂM CHỨNG.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/orders/orders.controller.ts backend/src/modules/orders/orders.service.ts backend/src/modules/orders/dto backend/src/modules/orders/orders.module.ts backend/src/app.module.ts backend/test/orders.e2e-spec.ts
git commit -m "feat(orders): add customer order list and detail APIs"
```

---

## Task 6: Admin Status Update Endpoint (Bài 191)

**Files:**
- Create: `backend/src/modules/orders/admin-orders.controller.ts`
- Create: `backend/src/modules/orders/dto/admin-update-order-status.dto.ts`
- Modify: `backend/src/modules/orders/orders.module.ts`
- Test: `backend/test/orders-admin.e2e-spec.ts`

**Interfaces:**
- Produces: `PATCH /api/v1/admin/orders/:orderId/status` (guards: JWT + `@Roles(UserRole.ADMIN)`), body `AdminUpdateOrderStatusDto { status: OrderStatus; reason?: string }` → `OrderDetailResponseDto` (reuse Task 5's mapper, admin variant if any extra field is truly needed — default to reusing the customer DTO unless a concrete need appears).

- [ ] **Step 1: Write failing e2e tests**

```typescript
it('rejects guest with 401', () => request(app).patch(`/api/v1/admin/orders/${orderId}/status`).send({ status: 'CONFIRMED' }).expect(401));
it('rejects CUSTOMER role with 403', async () => { /* auth as customer, expect 403 */ });
it('ADMIN moves PAID -> CONFIRMED, 200, body reflects new status', async () => { /* ... */ });
it('rejects PAID -> SHIPPED with 409 ORDER_TRANSITION_NOT_ALLOWED', async () => { /* ... */ });
it('rejects body containing paymentStatus/userId/total as unknown-property (whitelist validation)', async () => {
  const res = await request(app).patch(...).set(adminAuth).send({ status: 'CONFIRMED', paymentStatus: 'PAID', userId: 'x' });
  expect(res.status).toBe(400); // ValidationPipe forbidNonWhitelisted, confirm this is the repo's existing global pipe config
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && pnpm test:e2e orders-admin.e2e-spec.ts` — expect FAIL (route not found), or mark CHƯA KIỂM CHỨNG if Postgres unavailable and instead run a controller-level unit test as fallback.

- [ ] **Step 3: Implement `AdminUpdateOrderStatusDto` and controller**

```typescript
export class AdminUpdateOrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsString() @IsOptional() @MaxLength(500) reason?: string;
}

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOrdersController {
  @Patch(':orderId/status')
  updateStatus(@CurrentUser() admin: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: AdminUpdateOrderStatusDto) {
    return this.orderTransitionService.adminTransition(orderId, admin, dto.status, dto.reason)
      .then((order) => this.ordersService.getDetailForUser(order.id, order.userId)); // reuse mapper, bypass ownership check internally since actor is admin
  }
}
```

Note: `getDetailForUser` as written enforces `userId` match — for the admin path, either add an `OrdersService.getDetailById(orderId)` variant (no ownership filter) or pass `order.userId` explicitly as done above (works since we already have the just-updated order's true owner). Prefer adding an explicit `getDetailById` method for clarity — implement whichever keeps `orders.service.ts` from growing ownership-check branches inside one method.

- [ ] **Step 4: Confirm CONFIRMED->PAID payment status is untouched**

Add a test asserting `Payment.status` is unchanged after an admin order-status transition (proves the endpoint cannot touch payment status, since `AdminUpdateOrderStatusDto` has no such field and `PaymentEntity` is never touched by `OrderTransitionService`).

- [ ] **Step 5: Run tests, verify pass; wire controller into module**

Run: `cd backend && pnpm build && pnpm test:e2e orders-admin.e2e-spec.ts` (or unit fallback).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/admin-orders.controller.ts backend/src/modules/orders/dto/admin-update-order-status.dto.ts backend/src/modules/orders/orders.module.ts backend/test/orders-admin.e2e-spec.ts
git commit -m "feat(orders): enforce admin order state transitions via RBAC endpoint"
```

---

## Task 7: Customer Cancel Endpoint (wires Task 4 to HTTP) (Bài 192 cont.)

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.ts`
- Create: `backend/src/modules/orders/dto/cancel-order.dto.ts`
- Test: `backend/test/orders-cancellation.e2e-spec.ts` (includes concurrency test)

**Interfaces:**
- Produces: `POST /api/v1/orders/:orderId/cancel` (JWT required), body `CancelOrderDto { reason?: string }` → `OrderDetailResponseDto`.

- [ ] **Step 1: Write failing e2e tests including concurrency**

```typescript
it('owner cancels own PENDING_PAYMENT order', async () => { /* ... */ });
it('rejects cancelling another user\'s order with 404', async () => { /* ... */ });
it('rejects cancelling a PAID (COD) order with 409 ORDER_REFUND_REQUIRED', async () => { /* ... */ });
it('concurrent cancel + admin PAID->CONFIRMED yields one consistent final state', async () => {
  const order = await createPaidOrderFixtureViaApi();
  await agent.patch(`/admin/orders/${order.id}/status`).set(adminAuth).send({ status: 'CONFIRMED' });
  // Now attempt cancel; must fail with 409 REFUND_REQUIRED-or-transition error, not silently succeed
  const res = await agent.post(`/orders/${order.id}/cancel`).set(customerAuth);
  expect(res.status).toBe(409);
});
it('retrying cancel twice produces exactly one history row and one email job', async () => { /* assert via test mail adapter queue length */ });
```

- [ ] **Step 2: Run, verify failure/CHƯA KIỂM CHỨNG if no Postgres**

- [ ] **Step 3: Implement `CancelOrderDto` and controller method**

```typescript
export class CancelOrderDto {
  @IsString() @IsOptional() @MaxLength(500) reason?: string;
}

@Post(':orderId/cancel')
cancel(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: CancelOrderDto) {
  return this.orderTransitionService.cancelByCustomer(orderId, user.id, dto.reason)
    .then((order) => this.ordersService.getDetailForUser(order.id, user.id));
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/orders/orders.controller.ts backend/src/modules/orders/dto/cancel-order.dto.ts backend/test/orders-cancellation.e2e-spec.ts
git commit -m "feat(orders): expose customer order cancellation endpoint"
```

---

## Task 8: Order Emails — confirmation + status update (Bài 193/194)

**Files:**
- Modify: `backend/src/infrastructure/queue/email-job-name.enum.ts`
- Modify: `backend/src/infrastructure/queue/email.processor.ts`
- Create: `backend/src/infrastructure/mail/templates/order-confirmation.template.ts`
- Create: `backend/src/infrastructure/mail/templates/order-status-update.template.ts`
- Create: `backend/src/modules/orders/order-notification.service.ts`
- Modify: `backend/src/modules/checkout/checkout.service.ts` (enqueue confirmation after commit)
- Modify: `backend/src/modules/payments/payment-transition.service.ts` (enqueue paid-confirmation after commit)
- Modify: `backend/src/modules/orders/order-transition.service.ts` (call `notifyStatusChangeIfNeeded`/`notifyCancellation`, already referenced in Tasks 3/4 — implement the real bodies here)
- Test: `backend/src/modules/orders/order-notification.service.spec.ts`

**Interfaces:**
- Produces: `OrderNotificationService.notifyOrderPlaced(orderId: string): Promise<void>` — enqueues `SEND_ORDER_CONFIRMATION_EMAIL` with deterministic `jobId: order-confirmation:${orderId}` (BullMQ dedupes on `jobId`, giving idempotency without an in-memory Set).
- Produces: `OrderNotificationService.notifyStatusChangeIfNeeded(orderId: string, toStatus: OrderStatus): Promise<void>` — enqueues `SEND_ORDER_STATUS_UPDATE_EMAIL` with `jobId: order-status:${orderId}:${toStatus}` only if `toStatus` is in the customer-visible set `[CONFIRMED, PROCESSING, SHIPPED, DELIVERED]`.
- Produces: `OrderNotificationService.notifyCancellation(orderId: string): Promise<void>` — enqueues with `jobId: order-status:${orderId}:CANCELLED`.

- [ ] **Step 1: Write failing tests for enqueue policy (no real mail sent)**

```typescript
describe('OrderNotificationService', () => {
  it('enqueues confirmation with a deterministic jobId', async () => {
    await service.notifyOrderPlaced(order.id);
    expect(mailQueueMock.add).toHaveBeenCalledWith(EmailJobName.SEND_ORDER_CONFIRMATION_EMAIL, expect.anything(), expect.objectContaining({ jobId: `order-confirmation:${order.id}` }));
  });

  it('does not enqueue for internal-only transitions like PENDING_PAYMENT->PAID handled elsewhere, only listed customer-visible statuses', async () => {
    await service.notifyStatusChangeIfNeeded(order.id, OrderStatus.CONFIRMED);
    expect(mailQueueMock.add).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    // no-op case: CART is never passed in practice, but guard anyway
  });

  it('enqueuing the same status twice uses the same jobId (BullMQ will dedupe — assert jobId equality, not queue length, since dedupe is BullMQ\'s job not this service\'s)', async () => {
    await service.notifyStatusChangeIfNeeded(order.id, OrderStatus.SHIPPED);
    await service.notifyStatusChangeIfNeeded(order.id, OrderStatus.SHIPPED);
    const calls = mailQueueMock.add.mock.calls;
    expect(calls[0][2].jobId).toBe(calls[1][2].jobId);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && pnpm test order-notification.service.spec.ts` — expect FAIL.

- [ ] **Step 3: Implement `OrderNotificationService`**

```typescript
const CUSTOMER_VISIBLE_STATUSES = new Set([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]);

@Injectable()
export class OrderNotificationService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly mailQueue: Queue) {}

  async notifyOrderPlaced(orderId: string): Promise<void> {
    await this.mailQueue.add(EmailJobName.SEND_ORDER_CONFIRMATION_EMAIL, { orderId }, { jobId: `order-confirmation:${orderId}` });
  }

  async notifyStatusChangeIfNeeded(orderId: string, toStatus: OrderStatus): Promise<void> {
    if (!CUSTOMER_VISIBLE_STATUSES.has(toStatus)) return;
    await this.mailQueue.add(EmailJobName.SEND_ORDER_STATUS_UPDATE_EMAIL, { orderId, toStatus }, { jobId: `order-status:${orderId}:${toStatus}` });
  }

  async notifyCancellation(orderId: string): Promise<void> {
    await this.mailQueue.add(EmailJobName.SEND_ORDER_STATUS_UPDATE_EMAIL, { orderId, toStatus: OrderStatus.CANCELLED }, { jobId: `order-status:${orderId}:CANCELLED` });
  }
}
```

- [ ] **Step 4: Add `EmailJobName` values, processor cases, and templates**

`email-job-name.enum.ts`: add `SEND_ORDER_CONFIRMATION_EMAIL = 'send-order-confirmation-email'`, `SEND_ORDER_STATUS_UPDATE_EMAIL = 'send-order-status-update-email'`.

`email.processor.ts`: add `case EmailJobName.SEND_ORDER_CONFIRMATION_EMAIL:` loading the order (with items + shipping snapshot) fresh from DB by `orderId` from the job payload (never trust stale job payload for money fields — reload at send-time), render `orderConfirmationTemplate(order)`, call `this.mailService.send(...)`. Same pattern for status-update, passing `toStatus` label from Step 5's `order-status-labels` mapping.

`order-confirmation.template.ts` / `order-status-update.template.ts`: HTML string builders that escape all dynamic text (use a small `escapeHtml()` helper — check if one already exists in `infrastructure/mail`, reuse if so), format money with a `formatVnd(amountInteger)` helper (reuse existing formatter if present in `common/`), pull `orderNumber`-or-`id`, items, shipping snapshot, totals, and a tracking link built from `process.env.FRONTEND_BASE_URL` (grep for the existing env var name used by other emails, e.g. password-reset — reuse that exact variable name, don't invent a new one).

- [ ] **Step 5: Wire enqueue calls at commit boundaries**

In `checkout.service.ts`, after the `DataSource.transaction(...)` call that places a COD order resolves (i.e., after commit, not inside), call `this.orderNotificationService.notifyOrderPlaced(order.id)`. For PayOS, decide per plan §11 guidance: given webhook idempotency is already established (`PaymentTransitionService`), send confirmation **after webhook confirms PAID**, not at PENDING_PAYMENT creation — call `notifyOrderPlaced` from `PaymentTransitionService.finalizeOrderPaid`, after its transaction commits. Document this choice: avoids ambiguous "pending payment" email content entirely by only emailing once payment is confirmed.

In `order-transition.service.ts`, `adminTransition` and `cancelByCustomer` already call `notifyStatusChangeIfNeeded`/`notifyCancellation` after the transaction resolves (written in Tasks 3/4 as a `.then()` — confirm those calls target the real methods now implemented here).

- [ ] **Step 6: Test rollback does not enqueue**

```typescript
it('does not enqueue confirmation if the placing transaction throws', async () => {
  await expect(placeOrderThatFailsMidTransaction()).rejects.toThrow();
  expect(mailQueueMock.add).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run full backend test suite**

Run: `cd backend && pnpm test` — expect PASS (or note any pre-existing failures unrelated to this change, unmodified).

- [ ] **Step 8: Commit**

```bash
git add backend/src/infrastructure/queue backend/src/infrastructure/mail/templates backend/src/modules/orders/order-notification.service.ts backend/src/modules/checkout/checkout.service.ts backend/src/modules/payments/payment-transition.service.ts backend/src/modules/orders/order-transition.service.ts
git commit -m "feat(notifications): send idempotent order confirmation and status emails"
```

---

## Task 9: Swagger documentation for all new endpoints

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.ts`, `admin-orders.controller.ts`, all `dto/*.ts`

- [ ] **Step 1: Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty` decorators**

Match the exact Swagger convention already used in `checkout.controller.ts`/`payments.controller.ts` (read those first). Document auth requirement, ownership behavior, pagination params, status enum, transition rules, and every error code from `order-errors.ts` with example (non-real) values only.

- [ ] **Step 2: Boot the app and confirm Swagger JSON generates without error**

Run: `cd backend && pnpm start:dev` briefly (or `pnpm build` + check for decorator errors), then stop. Or run any existing Swagger-validation test/script if the repo has one (`grep -rn "swagger" backend/package.json`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/orders
git commit -m "docs(orders): document order endpoints in Swagger"
```

---

## Task 10: Frontend — Order types, service, query hooks (Bài 195)

**Files:**
- Create: `frontend/src/lib/types/order.ts`
- Create: `frontend/src/lib/api/orders.ts`
- Modify: `frontend/src/lib/api/query-keys.ts`
- Create: `frontend/src/lib/hooks/use-orders.ts`
- Create: `frontend/src/lib/hooks/use-order.ts`
- Create: `frontend/src/lib/hooks/use-cancel-order.ts`
- Test: `frontend/src/lib/api/orders.test.ts`
- Test: `frontend/src/lib/hooks/use-orders.test.tsx`, `use-order.test.tsx`, `use-cancel-order.test.tsx`

**Interfaces:**
- Produces: `OrderSummary`, `OrderDetail`, `OrderItem`, `OrderHistoryEntry`, `PaginatedOrders` types matching backend DTO shape exactly (field names, integer money).
- Produces: `ordersApi.list(params: OrderListParams, signal?: AbortSignal): Promise<PaginatedOrders>`, `ordersApi.getById(orderId: string, signal?: AbortSignal): Promise<OrderDetail>`, `ordersApi.cancel(orderId: string, body: { reason?: string }): Promise<OrderDetail>`.
- Produces: `queryKeys.orders.list(filters: OrderListParams)` alongside existing `orders.all`/`orders.detail(id)`.
- Produces: `useOrders(filters)`, `useOrder(orderId)`, `useCancelOrder()`.

- [ ] **Step 1: Read Ch18 convention files first**

Read `frontend/src/lib/hooks/use-addresses.ts`, `use-profile.ts`, and their `.test.tsx` counterparts, plus `frontend/src/lib/api/query-keys.ts` in full, to mirror exact patterns (query key normalization, error mapping, AbortSignal usage).

- [ ] **Step 2: Write failing test for the service layer**

```typescript
// orders.test.ts
it('calls GET /orders with normalized query params, no userId sent', async () => {
  mockAxios.onGet('/orders').reply(200, paginatedFixture);
  await ordersApi.list({ page: 1, limit: 20, status: 'PAID' });
  expect(mockAxios.history.get[0].params).toEqual({ page: 1, limit: 20, status: 'PAID' });
  expect(mockAxios.history.get[0].params).not.toHaveProperty('userId');
});

it('calls GET /orders/:id with the given id', async () => {
  mockAxios.onGet(`/orders/${orderId}`).reply(200, detailFixture);
  await ordersApi.getById(orderId);
  expect(mockAxios.history.get[0].url).toBe(`/orders/${orderId}`);
});

it('calls POST /orders/:id/cancel with only reason in the body', async () => {
  mockAxios.onPost(`/orders/${orderId}/cancel`).reply(200, cancelledFixture);
  await ordersApi.cancel(orderId, { reason: 'test' });
  const body = JSON.parse(mockAxios.history.post[0].data);
  expect(body).toEqual({ reason: 'test' });
  expect(body).not.toHaveProperty('status');
  expect(body).not.toHaveProperty('userId');
});
```

Match the exact HTTP mocking tool already used in the repo's existing `checkout.test.ts`/`payments.test.ts` (axios-mock-adapter, msw, or vitest `vi.mock`) — read one such file first, do not introduce a new mocking library.

- [ ] **Step 3: Run, verify failure**

Run: `cd frontend && pnpm test orders.test.ts` — expect FAIL.

- [ ] **Step 4: Implement types and service**

```typescript
// lib/types/order.ts
export interface OrderItem { id: string; productName: string; sku: string; imageUrl: string | null; unitPriceAmount: number; quantity: number; lineTotalAmount: number; }
export interface OrderHistoryEntry { toStatus: OrderStatus; createdAt: string; reason: string | null; }
export interface OrderSummary { id: string; status: OrderStatus; paymentMethod: string; createdAt: string; totalAmount: number; currency: 'VND'; itemCount: number; }
export interface OrderDetail extends OrderSummary { subtotalAmount: number; discountAmount: number; shippingFeeAmount: number; items: OrderItem[]; shippingAddress: { recipientName: string; phoneNumber: string; province: string; district: string; ward: string; streetAddress: string; note: string | null }; history: OrderHistoryEntry[]; }
export interface PaginatedOrders { data: OrderSummary[]; page: number; limit: number; total: number; totalPages: number; }
export interface OrderListParams { page?: number; limit?: number; status?: OrderStatus; sortBy?: 'createdAt' | 'totalAmount'; sortOrder?: 'ASC' | 'DESC'; }
```

```typescript
// lib/api/orders.ts
export const ordersApi = {
  list: (params: OrderListParams = {}, signal?: AbortSignal) =>
    apiClient.get<PaginatedOrders>('/orders', { params, signal }).then((r) => r.data),
  getById: (orderId: string, signal?: AbortSignal) =>
    apiClient.get<OrderDetail>(`/orders/${orderId}`, { signal }).then((r) => r.data),
  cancel: (orderId: string, body: { reason?: string }) =>
    apiClient.post<OrderDetail>(`/orders/${orderId}/cancel`, body).then((r) => r.data),
};
```

- [ ] **Step 5: Add `queryKeys.orders.list`**

```typescript
orders: {
  all: ['orders'] as const,
  lists: () => [...queryKeys.orders.all, 'list'] as const,
  list: (filters: OrderListParams) => [...queryKeys.orders.lists(), normalizeFilters(filters)] as const,
  details: () => [...queryKeys.orders.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.orders.details(), id] as const,
},
```

`normalizeFilters` sorts keys / drops `undefined` so equivalent filter objects produce the same key reference (check whether an existing normalize helper exists in the codebase for this — reuse it if so, e.g. from product filters).

- [ ] **Step 6: Implement hooks**

```typescript
export function useOrders(filters: OrderListParams = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: ({ signal }) => ordersApi.list(filters, signal),
    placeholderData: keepPreviousData, // for pagination UX, if TanStack v5 pattern used elsewhere
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: ({ signal }) => ordersApi.getById(orderId, signal),
    enabled: Boolean(orderId),
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) => ordersApi.cancel(orderId, { reason }),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.orders.detail(variables.orderId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
  });
}
```

- [ ] **Step 7: Run tests, verify pass**

Run: `cd frontend && pnpm test orders.test.ts use-orders.test.tsx use-order.test.tsx use-cancel-order.test.tsx` — expect PASS.

- [ ] **Step 8: Verify/wire logout cache clear**

Read `frontend/src/lib/auth/auth-provider.tsx`. If logout does not already call `queryClient.clear()` (or equivalent targeted clear of `queryKeys.orders.all` + other user-scoped keys), add it. Write a test asserting `useOrders`' cache is empty after logout.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/types/order.ts frontend/src/lib/api/orders.ts frontend/src/lib/api/query-keys.ts frontend/src/lib/hooks/use-orders.ts frontend/src/lib/hooks/use-order.ts frontend/src/lib/hooks/use-cancel-order.ts frontend/src/lib/auth/auth-provider.tsx
git commit -m "feat(account): add order services and query hooks"
```

---

## Task 11: Order status label mapping + Order card/timeline components

**Files:**
- Create: `frontend/src/lib/hooks/order-status-labels.ts`
- Create: `frontend/src/components/commerce/order-card.tsx`
- Create: `frontend/src/components/commerce/order-timeline.tsx`
- Modify: `frontend/src/components/commerce/status-badge.tsx`
- Test: `frontend/src/components/commerce/order-card.test.tsx`, `order-timeline.test.tsx`

**Interfaces:**
- Produces: `getOrderStatusLabel(status: OrderStatus): string`, `getOrderStatusVariant(status: OrderStatus): BadgeVariant` — single source used by list, detail, and timeline (spec explicitly forbids duplicate mappings).
- Produces: `<OrderCard order={OrderSummary} />`, `<OrderTimeline history={OrderHistoryEntry[]} currentStatus={OrderStatus} />`.

- [ ] **Step 1: Write failing component tests**

```typescript
it('OrderCard renders order number, date, status label, item count, total formatted as VND', () => {
  render(<OrderCard order={fixture} />);
  expect(screen.getByText(/₫|VNĐ/)).toBeInTheDocument(); // matches existing money-format convention, check what symbol/format is used elsewhere first
});
it('OrderTimeline renders each history entry with a real key (not array index)', () => { /* ... */ });
it('OrderTimeline for a CANCELLED order does not render future SHIPPED/DELIVERED as if pending', () => {
  render(<OrderTimeline history={cancelledHistoryFixture} currentStatus="CANCELLED" />);
  expect(screen.queryByText(/Đang giao/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd frontend && pnpm test order-card.test.tsx order-timeline.test.tsx` — expect FAIL.

- [ ] **Step 3: Implement `order-status-labels.ts`**

```typescript
const LABELS: Record<OrderStatus, string> = {
  CART: 'Giỏ hàng',
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};
export function getOrderStatusLabel(status: OrderStatus) { return LABELS[status]; }
```

- [ ] **Step 4: Implement `OrderCard` using existing `status-badge.tsx` + money formatter (grep for existing `formatCurrency`/`formatVnd` in frontend, reuse it — do not add a new currency library) and real React keys (`order.id`, `item.id`)**

- [ ] **Step 5: Implement `OrderTimeline` rendering only actual `history` entries in order, never inferring un-happened future steps for a `CANCELLED` order; for non-cancelled, linear known-lifecycle orders it may render remaining known steps dimmed, gated on `currentStatus !== 'CANCELLED'`**

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/hooks/order-status-labels.ts frontend/src/components/commerce/order-card.tsx frontend/src/components/commerce/order-timeline.tsx frontend/src/components/commerce/status-badge.tsx
git commit -m "feat(account): add shared order status labels and order card/timeline components"
```

---

## Task 12: Cancel Order Dialog (Bài 198)

**Files:**
- Create: `frontend/src/components/commerce/cancel-order-dialog.tsx`
- Test: `frontend/src/components/commerce/cancel-order-dialog.test.tsx`

**Interfaces:**
- Produces: `<CancelOrderDialog orderId={string} open={boolean} onOpenChange={(open: boolean) => void} triggerRef?={RefObject} />` built on `components/feedback/confirm-dialog.tsx`, wired to `useCancelOrder()`.

- [ ] **Step 1: Write failing tests**

```typescript
it('submit calls cancel mutation with orderId and trimmed reason, nothing else', async () => {
  const cancelSpy = vi.spyOn(ordersApi, 'cancel').mockResolvedValue(cancelledFixture);
  render(<CancelOrderDialog orderId="o1" open onOpenChange={vi.fn()} />, { wrapper: queryWrapper });
  await userEvent.type(screen.getByLabelText(/lý do/i), '  test reason  ');
  await userEvent.click(screen.getByRole('button', { name: /xác nhận hủy/i }));
  expect(cancelSpy).toHaveBeenCalledWith('o1', { reason: 'test reason' });
});

it('double-clicking submit only triggers one request', async () => {
  const cancelSpy = vi.spyOn(ordersApi, 'cancel').mockImplementation(() => new Promise((res) => setTimeout(() => res(cancelledFixture), 50)));
  render(<CancelOrderDialog orderId="o1" open onOpenChange={vi.fn()} />, { wrapper: queryWrapper });
  const btn = screen.getByRole('button', { name: /xác nhận hủy/i });
  await userEvent.click(btn);
  await userEvent.click(btn); // second click while pending
  expect(cancelSpy).toHaveBeenCalledTimes(1);
});

it('shows a friendly error and keeps the dialog open on 409 conflict, does not render as success', async () => {
  vi.spyOn(ordersApi, 'cancel').mockRejectedValue({ response: { status: 409, data: { code: 'ORDER_REFUND_REQUIRED', message: '...' } } });
  render(<CancelOrderDialog orderId="o1" open onOpenChange={vi.fn()} />, { wrapper: queryWrapper });
  await userEvent.click(screen.getByRole('button', { name: /xác nhận hủy/i }));
  expect(await screen.findByText(/không thể hủy|refund/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd frontend && pnpm test cancel-order-dialog.test.tsx` — expect FAIL.

- [ ] **Step 3: Implement `CancelOrderDialog` on top of `confirm-dialog.tsx`**

```tsx
export function CancelOrderDialog({ orderId, open, onOpenChange }: Props) {
  const [reason, setReason] = useState('');
  const cancelOrder = useCancelOrder();

  const handleConfirm = () => {
    if (cancelOrder.isPending) return; // guards double-click
    cancelOrder.mutate({ orderId, reason: reason.trim() || undefined }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Hủy đơn hàng"
      description="Bạn có chắc muốn hủy đơn hàng này? Thao tác không thể hoàn tác."
      confirmLabel="Xác nhận hủy"
      onConfirm={handleConfirm}
      confirmDisabled={cancelOrder.isPending}
    >
      <Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Lý do hủy đơn (không bắt buộc)" />
      {cancelOrder.isError && <p role="alert">{getApiErrorMessage(cancelOrder.error)}</p>}
    </ConfirmDialog>
  );
}
```

Match `ConfirmDialog`'s actual prop names exactly (read the file first — the props above are illustrative, not guaranteed).

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/commerce/cancel-order-dialog.tsx
git commit -m "feat(account): connect customer order cancellation dialog"
```

---

## Task 13: Account Orders List Page (Bài 196)

**Files:**
- Rewrite: `frontend/src/app/(store)/account/orders/page.tsx`
- Test: `frontend/src/app/(store)/account/orders/page.test.tsx`

- [ ] **Step 1: Write failing page tests**

```typescript
it('redirects guest to login', async () => { /* mimic Ch18 profile page guest-guard test exactly */ });
it('shows loading state then renders order cards', async () => { /* mock useOrders loading -> success */ });
it('shows empty state when there are zero orders', async () => { /* ... */ });
it('shows error state with retry button that refetches', async () => { /* ... */ });
it('status filter re-queries with the selected status', async () => { /* ... */ });
it('pagination controls move to next page', async () => { /* ... */ });
it('cancel button only renders for PENDING_PAYMENT orders', async () => { /* render list with mixed statuses, assert button presence per card */ });
```

- [ ] **Step 2: Run, verify failure**

Run: `cd frontend && pnpm test "account/orders/page.test.tsx"` — expect FAIL/mismatch against old mock-based assertions (existing test file, if any, must be replaced consistently with the rewrite, not deleted-and-abandoned — check if a test already exists for the mock version and rewrite it in the same PR).

- [ ] **Step 3: Rewrite `page.tsx` to use `useOrders`, `OrderCard`, `CancelOrderDialog`, existing `AccountNav`/account layout wrapper, loading/empty/error states matching Ch18 profile page's existing state-handling pattern (read that file first for the idiom)**

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(store)/account/orders/page.tsx" "frontend/src/app/(store)/account/orders/page.test.tsx"
git commit -m "feat(account): connect order list tab to real order API"
```

---

## Task 14: Order Tracking / Detail Page (Bài 197)

**Files:**
- Rewrite: `frontend/src/app/(store)/account/orders/[id]/page.tsx`
- Test: `frontend/src/app/(store)/account/orders/[id]/page.test.tsx`

- [ ] **Step 1: Write failing page tests**

```typescript
it('shows loading state', async () => { /* ... */ });
it('renders order detail from real API: items snapshot, shipping snapshot, price breakdown, timeline', async () => { /* ... */ });
it('shows a safe not-found state for 404 (own-deleted or other-user order), no internal detail leaked', async () => { /* ... */ });
it('renders timeline from history data, not inferred/fabricated steps for a cancelled order', async () => { /* ... */ });
it('does not call any Product or Address API to render this page (network assertion: only /orders/:id called)', async () => { /* ... */ });
it('shows cancel button only when order.status === PENDING_PAYMENT', async () => { /* ... */ });
it('after successful cancel, detail cache updates and cancel button disappears', async () => { /* ... */ });
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Rewrite `[id]/page.tsx` using `useOrder(orderId)`, `OrderTimeline`, item/shipping/price-breakdown sections all sourced from the single `OrderDetail` API response, `CancelOrderDialog` gated by status**

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(store)/account/orders/[id]/page.tsx" "frontend/src/app/(store)/account/orders/[id]/page.test.tsx"
git commit -m "feat(account): add real order tracking page with timeline and cancellation"
```

---

## Task 15: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Backend**

Run in `backend/`: `pnpm lint`, `pnpm build`, `pnpm test`, and (if Postgres test DB reachable — check via `docker ps` / attempt connection first) `pnpm test:e2e`. Record exact commands, exit codes, and failures verbatim. Do not use `--passWithNoTests`.

- [ ] **Step 2: Migration lifecycle**

If Postgres reachable: `pnpm typeorm migration:run`, `pnpm typeorm migration:revert`, `pnpm typeorm migration:run` again from `backend/`. Record output. If unreachable, mark CHƯA KIỂM CHỨNG.

- [ ] **Step 3: Frontend**

Run in `frontend/`: `pnpm lint`, `pnpm typecheck` (or `tsc --noEmit` if that's the actual script name — check `package.json` first), `pnpm test`, `pnpm build`.

- [ ] **Step 4: Secret/log scan**

Run from repo root: `rg -n "passwordHash|refreshToken|accessToken|Authorization|Cookie|DATABASE_URL|PAYOS_API_KEY|PAYOS_CHECKSUM_KEY|SMTP_PASSWORD|MAIL_PASSWORD" backend/src frontend/src` and `rg -n "console\.log|logger\.(debug|info|warn|error)" backend/src/modules/orders frontend/src/app/\(store\)/account/orders frontend/src/lib/hooks/use-orders.ts frontend/src/lib/hooks/use-order.ts frontend/src/lib/hooks/use-cancel-order.ts` — review every hit introduced by this chapter's diff for leaked secrets or PII in logs.

- [ ] **Step 5: git housekeeping**

Run `git status --short`, `git diff --stat`, `git log --oneline -20` from repo root. Confirm no unintended files staged/modified, confirm branch still `main` with all Ch19 commits present, confirm nothing pushed.

- [ ] **Step 6: Write final report**

Produce the report per the mega-spec's §31 structure (A–Q), citing exact commands run and their exact results for every claim, using only the allowed status vocabulary (`ĐÃ HOÀN THÀNH`, `ĐẠT MỘT PHẦN`, `CHƯA KIỂM CHỨNG`, etc.). No commit for this step (report is delivered as the final message to the user, not committed to the repo, unless the user has a docs convention requiring it — check for one first, and if none, just answer directly).
