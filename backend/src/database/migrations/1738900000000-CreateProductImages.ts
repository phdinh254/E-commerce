import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductImages1738900000000 implements MigrationInterface {
  name = 'CreateProductImages1738900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FK onDelete is RESTRICT for both product_id and variant_id — a
    // database CASCADE cannot also delete the corresponding Supabase
    // Storage object, so cascading here would silently orphan files.
    // Product/Variant "deletion" in this codebase is soft-delete (an
    // UPDATE, not a DELETE), so RESTRICT never actually blocks normal
    // operation — it only guards a real DELETE that should never happen.
    await queryRunner.query(`
      CREATE TABLE "product_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "storage_bucket" varchar(255) NOT NULL,
        "object_path" varchar(1024) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "alt_text" varchar(500),
        "display_order" integer NOT NULL DEFAULT 0,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_product_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_images_product_id" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_product_images_variant_id" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_product_images_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_product_images_size_bytes_positive" CHECK ("size_bytes" > 0),
        CONSTRAINT "CHK_product_images_display_order_non_negative" CHECK ("display_order" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_product_images_product_id"
        ON "product_images" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_images_variant_id"
        ON "product_images" ("variant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_images_product_id_display_order"
        ON "product_images" ("product_id", "display_order")
    `);
    // Public/list queries always filter deleted_at IS NULL — index scoped
    // to live rows only keeps that filter cheap as the table grows.
    await queryRunner.query(`
      CREATE INDEX "IDX_product_images_product_id_live"
        ON "product_images" ("product_id")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_images_bucket_object_path"
        ON "product_images" ("storage_bucket", "object_path")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_images"`);
  }
}
