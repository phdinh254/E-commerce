import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAddresses1738200000000 implements MigrationInterface {
  name = 'CreateAddresses1738200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "recipient_name" varchar(255) NOT NULL,
        "phone_number" varchar(20) NOT NULL,
        "province" varchar(255) NOT NULL,
        "district" varchar(255) NOT NULL,
        "ward" varchar(255) NOT NULL,
        "street_address" varchar(255) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_addresses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_addresses_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_addresses_user_id" ON "addresses" ("user_id")
    `);

    // Partial unique index: at most one active (non-soft-deleted) default
    // address per user. Soft-deleting the current default frees the slot.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_addresses_user_default_active"
        ON "addresses" ("user_id")
        WHERE "is_default" = true AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_addresses_user_default_active"`);
    await queryRunner.query(`DROP INDEX "IDX_addresses_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "addresses" DROP CONSTRAINT "FK_addresses_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "addresses"`);
  }
}
