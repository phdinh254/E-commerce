import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chapter 15 — cart-is-order pattern. An `orders` row with status='CART' IS
 * the user's cart; there is no separate Cart/CartItem table. The enum
 * vocabulary includes post-cart statuses (PENDING_PAYMENT/PAID/CANCELLED)
 * even though this chapter only ever writes/reads CART, so a later
 * checkout chapter does not need a painful `ALTER TYPE ... ADD VALUE`
 * migration mid-project.
 */
export class CreateCartOrderSchema1739100000000 implements MigrationInterface {
  name = 'CreateCartOrderSchema1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "orders_status_enum" AS ENUM (
        'CART', 'PENDING_PAYMENT', 'PAID', 'CANCELLED'
      )
    `);

    // --- orders (= cart while status = 'CART') --------------------------
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "status" "orders_status_enum" NOT NULL DEFAULT 'CART',
        "subtotal_amount" integer NOT NULL DEFAULT 0,
        "total_amount" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_orders_subtotal_amount_non_negative" CHECK ("subtotal_amount" >= 0),
        CONSTRAINT "CHK_orders_total_amount_non_negative" CHECK ("total_amount" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_user_id" ON "orders" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_status" ON "orders" ("status")
    `);
    // Load-bearing constraint: at most one active CART order per user,
    // enforced by Postgres itself (partial unique index), not merely by a
    // service-level SELECT-then-INSERT check that races under concurrency.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_orders_user_id_active_cart"
        ON "orders" ("user_id")
        WHERE "status" = 'CART'
    `);

    // --- order_items ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "quantity" integer NOT NULL,
        "unit_price_amount" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order_id" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_order_items_variant_id" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_order_items_unit_price_amount_non_negative" CHECK ("unit_price_amount" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_product_id" ON "order_items" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_variant_id" ON "order_items" ("variant_id")
    `);
    // A plain UNIQUE(order_id, product_id, variant_id) would NOT prevent two
    // rows for the same product with variant_id both NULL, since Postgres
    // treats NULL <> NULL in ordinary unique indexes. Split into two partial
    // unique indexes so "no variant" lines are just as unique as "has
    // variant" lines.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_order_items_order_product_variant"
        ON "order_items" ("order_id", "product_id", "variant_id")
        WHERE "variant_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_order_items_order_product_null_variant"
        ON "order_items" ("order_id", "product_id")
        WHERE "variant_id" IS NULL
    `);

    // --- order_status_histories --------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "order_status_histories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "from_status" "orders_status_enum",
        "to_status" "orders_status_enum" NOT NULL,
        "changed_by" uuid,
        "reason" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_status_histories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_status_histories_order_id" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_status_histories_order_id" ON "order_status_histories" ("order_id")
    `);

    // --- idempotency_keys ---------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "operation" varchar(64) NOT NULL,
        "idempotency_key" varchar(128) NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "response_status" integer NOT NULL,
        "response_body" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_keys_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_idempotency_keys_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    // The idempotency guarantee itself: whichever request inserts first for
    // a given (user, operation, key) wins; concurrent/retried duplicates hit
    // this constraint instead of double-applying the mutation — same
    // philosophy as guest_claims.guest_id.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_idempotency_keys_user_operation_key"
        ON "idempotency_keys" ("user_id", "operation", "idempotency_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_keys_created_at" ON "idempotency_keys" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE "order_status_histories"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "orders_status_enum"`);
  }
}
