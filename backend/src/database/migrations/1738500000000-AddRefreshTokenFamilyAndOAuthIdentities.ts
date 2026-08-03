import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenFamilyAndOAuthIdentities1738500000000 implements MigrationInterface {
  name = 'AddRefreshTokenFamilyAndOAuthIdentities1738500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Refresh-token rotation family: lets reuse detection revoke every
    // token descended from the same login, not just the presented one.
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" uuid
    `);
    // Existing rows predate the family concept; treat each as the root of
    // its own family so no historical row is left null.
    await queryRunner.query(`
      UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")
    `);

    // Google OAuth accounts register without a password.
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "oauth_identities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "provider_account_id" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_identities_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_oauth_identities_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_oauth_identities_provider_account" ON "oauth_identities" ("provider", "provider_account_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_oauth_identities_user_id" ON "oauth_identities" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "oauth_identities"`);
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_refresh_tokens_family_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" DROP COLUMN "family_id"
    `);
  }
}
