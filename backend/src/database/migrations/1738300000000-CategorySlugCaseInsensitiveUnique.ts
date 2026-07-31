import { MigrationInterface, QueryRunner } from 'typeorm';

interface LowerSlugCollision {
  lower_slug: string;
  count: string;
}

/**
 * The original CreateCategories migration enforced slug uniqueness with a
 * plain (case-sensitive) UNIQUE constraint, which allows "dien-tu" and
 * "Dien-Tu" to coexist — verified directly against PostgreSQL. Category CRUD
 * does not exist yet, so nothing normalizes slugs before insert; the
 * database must own case-insensitive uniqueness itself. This migration
 * replaces the plain unique constraint with a unique functional index on
 * lower(slug), keeping the existing "global unique, including soft-deleted
 * rows" decision (no WHERE deleted_at IS NULL clause).
 */
export class CategorySlugCaseInsensitiveUnique1738300000000 implements MigrationInterface {
  name = 'CategorySlugCaseInsensitiveUnique1738300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const collisions = (await queryRunner.query(`
      SELECT lower("slug") AS lower_slug, COUNT(*) AS count
      FROM "categories"
      GROUP BY lower("slug")
      HAVING COUNT(*) > 1
    `)) as LowerSlugCollision[];

    if (collisions.length > 0) {
      const examples = collisions
        .slice(0, 5)
        .map((row) => `"${row.lower_slug}" (${row.count} rows)`)
        .join(', ');
      throw new Error(
        `Cannot enforce a case-insensitive unique slug: ${collisions.length} ` +
          `slug group(s) collide when lowercased, e.g. ${examples}. Resolve ` +
          'these duplicate category slugs manually, then re-run this migration.',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "UQ_categories_slug"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_slug_lower"
        ON "categories" (lower("slug"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_categories_slug_lower"`);
    await queryRunner.query(`
      ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
    `);
  }
}
