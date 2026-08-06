import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ch18: address list/form UI needs a short user-facing label ("Nhà riêng",
 * "Công ty") distinct from the per-order `shippingNote` on checkout — label
 * describes the saved address itself, note is a one-time instruction for a
 * single order. Nullable: existing rows (and new addresses) are valid
 * without one.
 */
export class AddAddressLabel1739400000000 implements MigrationInterface {
  name = 'AddAddressLabel1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "addresses"
        ADD COLUMN "label" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "addresses"
        DROP COLUMN "label"
    `);
  }
}
