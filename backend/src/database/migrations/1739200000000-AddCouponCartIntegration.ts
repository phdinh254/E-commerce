import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chapter 16 — wires the Chapter 12 `coupons` table (schema-only until now,
 * zero business logic) into the Chapter 15 cart-is-order `orders` table.
 *
 * `name`/`description` are a targeted gap-fill: Ch12's CouponEntity never
 * had them, but Ch16's featured/applied-coupon UI needs human-readable
 * text — added nullable so existing Ch12 seed rows stay valid.
 * `is_featured`/`featured_order` mirror ProductEntity's own featured
 * columns/index shape exactly (Ch16-B155).
 */
export class AddCouponCartIntegration1739200000000 implements MigrationInterface {
  name = 'AddCouponCartIntegration1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- coupons: gap-fill + featured -----------------------------------
    await queryRunner.query(`
      ALTER TABLE "coupons"
        ADD COLUMN "name" varchar(255),
        ADD COLUMN "description" varchar(1000),
        ADD COLUMN "is_featured" boolean NOT NULL DEFAULT false,
        ADD COLUMN "featured_order" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "coupons"
        ADD CONSTRAINT "CHK_coupons_featured_order_non_negative" CHECK ("featured_order" >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_is_featured_featured_order"
        ON "coupons" ("is_featured", "featured_order")
    `);

    // --- orders: coupon association + discount snapshot -------------------
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "coupon_id" uuid,
        ADD COLUMN "coupon_code_snapshot" varchar(50),
        ADD COLUMN "coupon_name_snapshot" varchar(255),
        ADD COLUMN "coupon_discount_type_snapshot" "coupons_discount_type_enum",
        ADD COLUMN "coupon_discount_value_snapshot" integer,
        ADD COLUMN "discount_amount" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "FK_orders_coupon_id" FOREIGN KEY ("coupon_id")
          REFERENCES "coupons" ("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "CHK_orders_discount_amount_non_negative" CHECK ("discount_amount" >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_coupon_id" ON "orders" ("coupon_id")
    `);

    // --- coupon_redemptions: usage audit trail, one row per order ------------
    await queryRunner.query(`
      CREATE TABLE "coupon_redemptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coupon_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "discount_amount" integer NOT NULL,
        "coupon_code_snapshot" varchar(50) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_redemptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_coupon_redemptions_coupon_id" FOREIGN KEY ("coupon_id")
          REFERENCES "coupons" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_coupon_redemptions_order_id" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_redemptions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_coupon_redemptions_discount_amount_non_negative"
          CHECK ("discount_amount" >= 0)
      )
    `);
    // The redemption guarantee for the whole confirmation flow: whichever
    // request inserts first for a given order wins; every other concurrent
    // or retried confirmation hits this constraint instead of double-
    // counting usage — mirrors guest_claims.guest_id / idempotency_keys.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_coupon_redemptions_order_id"
        ON "coupon_redemptions" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_redemptions_coupon_id_user_id"
        ON "coupon_redemptions" ("coupon_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "coupon_redemptions"`);

    await queryRunner.query(`DROP INDEX "IDX_orders_coupon_id"`);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_discount_amount_non_negative"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_coupon_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN "discount_amount",
        DROP COLUMN "coupon_discount_value_snapshot",
        DROP COLUMN "coupon_discount_type_snapshot",
        DROP COLUMN "coupon_name_snapshot",
        DROP COLUMN "coupon_code_snapshot",
        DROP COLUMN "coupon_id"
    `);

    await queryRunner.query(
      `DROP INDEX "IDX_coupons_is_featured_featured_order"`,
    );
    await queryRunner.query(`
      ALTER TABLE "coupons" DROP CONSTRAINT "CHK_coupons_featured_order_non_negative"
    `);
    await queryRunner.query(`
      ALTER TABLE "coupons"
        DROP COLUMN "featured_order",
        DROP COLUMN "is_featured",
        DROP COLUMN "description",
        DROP COLUMN "name"
    `);
  }
}
