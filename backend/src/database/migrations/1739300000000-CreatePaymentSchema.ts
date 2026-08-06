import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chapter 17 — Payment schema. `orders` gains shipping snapshot columns
 * (AddressesModule is entity-only, no service yet — checkout accepts
 * shipping fields directly and freezes them here) and `placed_at` (the
 * moment an Order left CART). New `payments` table supports multiple
 * attempts per order (PayOS retry after a cancelled/expired link) — no
 * single-column unique on order_id, only `(provider, provider_order_code)`.
 * `payos_order_code_seq` is the DB-level uniqueness/monotonicity guarantee
 * for PayOS orderCode (never generated in application code from
 * Date.now() or similar). `payment_webhook_events` is the dedup ledger:
 * `UNIQUE(provider, external_event_key)` is what makes a resent identical
 * webhook payload a safe no-op — same "unique-constraint-is-the-lock"
 * philosophy as guest_claims/idempotency_keys/coupon_redemptions.
 */
export class CreatePaymentSchema1739300000000 implements MigrationInterface {
  name = 'CreatePaymentSchema1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- orders: shipping snapshot + placed_at ---------------------------
    // Field names mirror AddressEntity's own columns (recipient_name,
    // phone_number, province/district/ward, street_address) — AddressesModule
    // is entity-only (no service), so checkout accepts these directly on the
    // request DTO and freezes them here rather than depending on an
    // unfinished module.
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "shipping_recipient_name" varchar(255),
        ADD COLUMN "shipping_phone_number" varchar(20),
        ADD COLUMN "shipping_province" varchar(255),
        ADD COLUMN "shipping_district" varchar(255),
        ADD COLUMN "shipping_ward" varchar(255),
        ADD COLUMN "shipping_street_address" varchar(255),
        ADD COLUMN "shipping_note" varchar(500),
        ADD COLUMN "placed_at" timestamptz
    `);

    // --- payos_order_code_seq ---------------------------------------------
    // Started well above any plausible test-data id space; DB-generated so
    // it is unique and monotonic without any application-level collision
    // retry logic.
    await queryRunner.query(`
      CREATE SEQUENCE "payos_order_code_seq" START WITH 100000000 INCREMENT BY 1
    `);

    // --- payments -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "payments_provider_enum" AS ENUM ('COD', 'PAYOS')
    `);
    await queryRunner.query(`
      CREATE TYPE "payments_status_enum" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "provider" "payments_provider_enum" NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "amount" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'VND',
        "provider_order_code" bigint,
        "provider_payment_link_id" varchar(255),
        "checkout_url" varchar(2048),
        "description" varchar(255),
        "attempt_number" integer NOT NULL DEFAULT 1,
        "paid_at" timestamptz,
        "cancelled_at" timestamptz,
        "expired_at" timestamptz,
        "failed_at" timestamptz,
        "failure_reason" varchar(500),
        "last_synced_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_order_id" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_payments_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "CHK_payments_attempt_number_positive" CHECK ("attempt_number" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_order_id" ON "payments" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_order_id_status" ON "payments" ("order_id", "status")
    `);
    // Partial: COD payments never carry a provider_order_code, so only
    // PayOS rows participate in this uniqueness guarantee.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payments_provider_order_code"
        ON "payments" ("provider", "provider_order_code")
        WHERE "provider_order_code" IS NOT NULL
    `);

    // --- payment_webhook_events (dedup ledger) -----------------------------
    await queryRunner.query(`
      CREATE TABLE "payment_webhook_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "provider" "payments_provider_enum" NOT NULL,
        "external_event_key" varchar(64) NOT NULL,
        "provider_order_code" bigint,
        "event_status" varchar(50),
        "processing_result" varchar(20) NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        CONSTRAINT "PK_payment_webhook_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_webhook_events_provider_key"
        ON "payment_webhook_events" ("provider", "external_event_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_webhook_events_provider_order_code"
        ON "payment_webhook_events" ("provider_order_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_webhook_events"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "payments_provider_enum"`);
    await queryRunner.query(`DROP SEQUENCE "payos_order_code_seq"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN "placed_at",
        DROP COLUMN "shipping_note",
        DROP COLUMN "shipping_street_address",
        DROP COLUMN "shipping_ward",
        DROP COLUMN "shipping_district",
        DROP COLUMN "shipping_province",
        DROP COLUMN "shipping_phone_number",
        DROP COLUMN "shipping_recipient_name"
    `);
  }
}
