import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chapter 19 (Order Management), Task 1.
 *
 * Step 1 finding: `orders.status` (and `order_status_histories.from_status`
 * / `to_status`) is backed by a native Postgres enum type
 * `orders_status_enum`, created via `CREATE TYPE ... AS ENUM (...)` in
 * 1739100000000-CreateCartOrderSchema.ts — NOT a varchar+CHECK constraint.
 * Adding fulfillment statuses therefore requires `ALTER TYPE ... ADD VALUE`
 * rather than a CHECK constraint drop/recreate.
 *
 * Postgres 12+ allows `ALTER TYPE ... ADD VALUE` inside a transaction as
 * long as the new value is not *used* (e.g. compared, cast) within that
 * same transaction — this migration only adds the values and does not read
 * or write rows using them, so running it inside TypeORM's default
 * single-transaction migration run is safe.
 */
export class AddOrderFulfillmentStatuses1754500000000
  implements MigrationInterface
{
  name = 'AddOrderFulfillmentStatuses1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- orders_status_enum: add fulfillment statuses -----------------
    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'CONFIRMED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'SHIPPED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'DELIVERED'`,
    );

    // --- order_status_histories: changed_by -> actor_type/actor_id -----
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
    await queryRunner.query(
      `ALTER TABLE "order_status_histories" ALTER COLUMN "actor_type" DROP DEFAULT`,
    );

    // --- order_items: product/sku/image snapshot columns ----------------
    // All three are nullable. The cart-is-order pattern means OrderItem
    // rows exist for CART-status (and PENDING_PAYMENT-status) orders before
    // checkout ever runs, and the spec requires these snapshots to reflect
    // data "at order placement" (checkout time) — not add-to-cart time.
    // Forcing NOT NULL here would require a meaningless placeholder value
    // for every pre-checkout row. Task 2 (checkout.service.ts, at order
    // finalization, before transitioning out of CART/PENDING_PAYMENT) is
    // responsible for populating product_name_snapshot/sku_snapshot; this
    // migration only adds the columns.
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN "product_name_snapshot" varchar(255) NULL,
      ADD COLUMN "sku_snapshot" varchar(100) NULL,
      ADD COLUMN "image_url_snapshot" varchar(1024) NULL
    `);

    // Backfill existing order_items snapshot from current product/variant
    // data — best-effort only. This is a historical approximation for rows
    // that predate this migration (the product/variant may have since been
    // renamed), not a fabrication of what the name/sku were at order time.
    // Postgres UPDATE ... FROM cannot reference the target table ("oi")
    // inside a JOIN condition in the FROM clause, so the product/variant
    // join is done in a subquery keyed by order_items.id instead.
    await queryRunner.query(`
      UPDATE "order_items" oi
      SET "product_name_snapshot" = sub."name",
          "sku_snapshot" = sub."sku"
      FROM (
        SELECT
          oi2."id" AS "item_id",
          p."name" AS "name",
          COALESCE(pv."sku", p."sku", '') AS "sku"
        FROM "order_items" oi2
        JOIN "products" p ON p."id" = oi2."product_id"
        LEFT JOIN "product_variants" pv ON pv."id" = oi2."variant_id"
      ) sub
      WHERE oi."id" = sub."item_id"
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_order_status_histories_order_id_created_at"
      ON "order_status_histories" ("order_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_order_status_histories_order_id_created_at"`,
    );

    await queryRunner.query(`
      ALTER TABLE "order_items"
      DROP COLUMN "product_name_snapshot",
      DROP COLUMN "sku_snapshot",
      DROP COLUMN "image_url_snapshot"
    `);

    await queryRunner.query(
      `ALTER TABLE "order_status_histories" RENAME COLUMN "actor_id" TO "changed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_histories" DROP COLUMN "actor_type"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "order_status_histories_actor_type_enum"`,
    );

    // Note: Postgres cannot drop individual enum values (DROP VALUE does not
    // exist; the only way is to rebuild the type, which would require
    // rewriting every dependent column and is out of scope for a routine
    // down migration). down() intentionally leaves the four fulfillment
    // values (CONFIRMED, PROCESSING, SHIPPED, DELIVERED) on
    // "orders_status_enum" in place — this is a documented, non-destructive
    // no-op for that part of the migration. No row can be *written* with
    // these values unless application code sets them, so this is safe to
    // leave behind.
  }
}
