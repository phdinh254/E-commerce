import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories1738100000000 implements MigrationInterface {
  name = 'CreateCategories1738100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "parent_id" uuid,
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "description" varchar(1000),
        "image_url" varchar(2048),
        "display_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_categories_parent_id" FOREIGN KEY ("parent_id")
          REFERENCES "categories" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_categories_parent_not_self"
          CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
        CONSTRAINT "CHK_categories_display_order_non_negative"
          CHECK ("display_order" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_categories_parent_id_display_order"
        ON "categories" ("parent_id", "display_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_categories_parent_id_display_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parent_id"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
