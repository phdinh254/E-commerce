import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New schema added as a Chapter 12 (seed data) prerequisite — there was no
 * Coupon table anywhere in the repository before this. Not a Chapter 10/11
 * bugfix; see docs/seed-strategy.md for why this exists.
 */
export class CreateCoupons1739000000000 implements MigrationInterface {
  name = 'CreateCoupons1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "coupons_discount_type_enum" AS ENUM ('PERCENTAGE', 'FIXED')
    `);

    await queryRunner.query(`
      CREATE TABLE "coupons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "discount_type" "coupons_discount_type_enum" NOT NULL,
        "discount_value" integer NOT NULL,
        "min_order_amount" integer NOT NULL DEFAULT 0,
        "max_discount_amount" integer,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "usage_limit" integer,
        "per_user_limit" integer,
        "used_count" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "applicable_category_id" uuid,
        "applicable_product_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_coupons_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_coupons_applicable_category_id" FOREIGN KEY ("applicable_category_id")
          REFERENCES "categories" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_coupons_applicable_product_id" FOREIGN KEY ("applicable_product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_coupons_discount_value_valid_for_type" CHECK (
          ("discount_type" = 'PERCENTAGE' AND "discount_value" > 0 AND "discount_value" <= 100)
          OR ("discount_type" = 'FIXED' AND "discount_value" > 0)
        ),
        CONSTRAINT "CHK_coupons_min_order_amount_non_negative" CHECK ("min_order_amount" >= 0),
        CONSTRAINT "CHK_coupons_max_discount_amount_non_negative" CHECK (
          "max_discount_amount" IS NULL OR "max_discount_amount" >= 0
        ),
        CONSTRAINT "CHK_coupons_ends_after_starts" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "CHK_coupons_usage_limit_positive" CHECK (
          "usage_limit" IS NULL OR "usage_limit" > 0
        ),
        CONSTRAINT "CHK_coupons_per_user_limit_positive" CHECK (
          "per_user_limit" IS NULL OR "per_user_limit" > 0
        ),
        CONSTRAINT "CHK_coupons_used_count_non_negative" CHECK ("used_count" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_coupons_code_upper" ON "coupons" (upper("code"))
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_is_active" ON "coupons" ("is_active")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_applicable_category_id" ON "coupons" ("applicable_category_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_applicable_product_id" ON "coupons" ("applicable_product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TYPE "coupons_discount_type_enum"`);
  }
}
