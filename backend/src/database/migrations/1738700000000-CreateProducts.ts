import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1738700000000 implements MigrationInterface {
  name = 'CreateProducts1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "sku" varchar(64) NOT NULL,
        "short_description" varchar(500),
        "description" text,
        "price" integer NOT NULL,
        "thumbnail_url" varchar(2048),
        "is_active" boolean NOT NULL DEFAULT true,
        "is_featured" boolean NOT NULL DEFAULT false,
        "featured_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category_id" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_products_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_products_featured_order_non_negative"
          CHECK ("featured_order" >= 0)
      )
    `);

    // Case-insensitive uniqueness (mirrors categories.slug): the app always
    // normalizes slug/sku before writing, but the DB — not the app — is the
    // actual source of truth for uniqueness under concurrent requests.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_products_slug_lower"
        ON "products" (lower("slug"))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_products_sku_upper"
        ON "products" (upper("sku"))
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_category_id" ON "products" ("category_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_is_active" ON "products" ("is_active")
    `);
    // Serves the featured-products landing query: WHERE is_featured = true
    // ORDER BY featured_order ASC.
    await queryRunner.query(`
      CREATE INDEX "IDX_products_is_featured_display_order"
        ON "products" ("is_featured", "featured_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_products_is_featured_display_order"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_products_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_products_category_id"`);
    await queryRunner.query(`DROP INDEX "UQ_products_sku_upper"`);
    await queryRunner.query(`DROP INDEX "UQ_products_slug_lower"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
