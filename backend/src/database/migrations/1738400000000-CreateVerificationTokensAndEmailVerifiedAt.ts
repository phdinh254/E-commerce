import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVerificationTokensAndEmailVerifiedAt1738400000000 implements MigrationInterface {
  name = 'CreateVerificationTokensAndEmailVerifiedAt1738400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamptz
    `);

    await queryRunner.query(`
      CREATE TYPE "verification_tokens_purpose_enum" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET')
    `);

    await queryRunner.query(`
      CREATE TABLE "verification_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "purpose" "verification_tokens_purpose_enum" NOT NULL,
        "token_hash" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verification_tokens_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_verification_tokens_token_hash" ON "verification_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_verification_tokens_user_id" ON "verification_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "verification_tokens"`);
    await queryRunner.query(`DROP TYPE "verification_tokens_purpose_enum"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "email_verified_at"
    `);
  }
}
