import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductVariants1738800000000 implements MigrationInterface {
  name = 'CreateProductVariants1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- product_options ---------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "product_options" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "normalized_name" varchar(100) NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_options_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_options_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_options_display_order_non_negative"
          CHECK ("display_order" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_options_product_id"
        ON "product_options" ("product_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_options_product_id_normalized_name"
        ON "product_options" ("product_id", "normalized_name")
    `);

    // --- product_option_values -----------------------------------------
    await queryRunner.query(`
      CREATE TABLE "product_option_values" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "option_id" uuid NOT NULL,
        "value" varchar(100) NOT NULL,
        "normalized_value" varchar(100) NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_option_values_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_option_values_option_id" FOREIGN KEY ("option_id")
          REFERENCES "product_options" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_option_values_display_order_non_negative"
          CHECK ("display_order" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_option_values_option_id"
        ON "product_option_values" ("option_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_option_values_option_id_normalized_value"
        ON "product_option_values" ("option_id", "normalized_value")
    `);

    // --- product_variants ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "sku" varchar(64) NOT NULL,
        "combination_key" varchar(64) NOT NULL,
        "price" integer NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variants_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_variants_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_variants_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_product_variants_stock_non_negative" CHECK ("stock" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_variants_product_id"
        ON "product_variants" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_variants_product_id_is_active"
        ON "product_variants" ("product_id", "is_active")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_variants_product_id_combination_key"
        ON "product_variants" ("product_id", "combination_key")
    `);
    // Case-insensitive, table-wide (not per-product) — mirrors
    // products.sku's own upper(sku) unique index. See business rules doc
    // for why this is a deliberately separate namespace from Product.sku.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_variants_sku_upper"
        ON "product_variants" (upper("sku"))
    `);

    // --- product_variant_option_values (join table) ----------------------
    await queryRunner.query(`
      CREATE TABLE "product_variant_option_values" (
        "variant_id" uuid NOT NULL,
        "option_value_id" uuid NOT NULL,
        "option_id" uuid NOT NULL,
        CONSTRAINT "PK_product_variant_option_values" PRIMARY KEY ("variant_id", "option_value_id"),
        CONSTRAINT "FK_product_variant_option_values_variant_id" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_variant_option_values_option_value_id" FOREIGN KEY ("option_value_id")
          REFERENCES "product_option_values" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_variant_option_values_option_value_id"
        ON "product_variant_option_values" ("option_value_id")
    `);

    // --- product_variant_change_logs (audit) ------------------------------
    await queryRunner.query(`
      CREATE TYPE "product_variant_change_type" AS ENUM ('PRICE', 'STOCK')
    `);
    await queryRunner.query(`
      CREATE TABLE "product_variant_change_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "change_type" "product_variant_change_type" NOT NULL,
        "old_value" integer NOT NULL,
        "new_value" integer NOT NULL,
        "delta" integer NOT NULL,
        "reason" varchar(500) NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "mutation_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variant_change_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_variant_change_logs_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_product_variant_change_logs_variant_id" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_product_variant_change_logs_actor_user_id" FOREIGN KEY ("actor_user_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_variant_change_logs_variant_id_created_at"
        ON "product_variant_change_logs" ("variant_id", "created_at")
    `);

    // --- product_attributes ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "product_attributes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "normalized_name" varchar(100) NOT NULL,
        "value" varchar(500) NOT NULL,
        "unit" varchar(50),
        "display_order" integer NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_product_attributes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_attributes_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_attributes_display_order_non_negative"
          CHECK ("display_order" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_attributes_product_id"
        ON "product_attributes" ("product_id")
    `);
    // Partial unique index: only active (non-soft-deleted) rows must be
    // unique — an attribute name becomes reusable again once deleted. See
    // the entity's class comment for why this differs from
    // Product/Category slug's "unique forever" policy.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_attributes_product_id_normalized_name_active"
        ON "product_attributes" ("product_id", "normalized_name")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_attributes"`);

    await queryRunner.query(`DROP TABLE "product_variant_change_logs"`);
    await queryRunner.query(`DROP TYPE "product_variant_change_type"`);

    await queryRunner.query(`DROP TABLE "product_variant_option_values"`);

    await queryRunner.query(`DROP TABLE "product_variants"`);

    await queryRunner.query(`DROP TABLE "product_option_values"`);

    await queryRunner.query(`DROP TABLE "product_options"`);
  }
}
