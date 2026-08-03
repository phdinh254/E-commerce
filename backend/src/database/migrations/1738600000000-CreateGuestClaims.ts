import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuestClaims1738600000000 implements MigrationInterface {
  name = 'CreateGuestClaims1738600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guest_claims" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "guest_id" varchar(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "claimed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_claims_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guest_claims_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    // The idempotency guarantee for the whole claim flow: whichever request
    // inserts first for a given guest_id wins; every other concurrent or
    // retried attempt hits this constraint instead of double-claiming.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_guest_claims_guest_id" ON "guest_claims" ("guest_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_guest_claims_user_id" ON "guest_claims" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping this table erases the record of which guest sessions were
    // already claimed by which user. That is only safe because the guest
    // Redis sessions themselves are ephemeral and already revoked by the
    // time a claim row exists — there is no live guest state this table is
    // the last copy of. It does NOT restore any previously-claimed guest
    // session; a reverted environment loses claim history, not live data.
    await queryRunner.query(`DROP INDEX "IDX_guest_claims_user_id"`);
    await queryRunner.query(`DROP INDEX "UQ_guest_claims_guest_id"`);
    await queryRunner.query(`DROP TABLE "guest_claims"`);
  }
}
