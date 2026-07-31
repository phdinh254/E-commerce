import { DataSource } from 'typeorm';
import dataSource from '../src/database/data-source';
import { CategoryEntity } from '../src/modules/categories/entities/category.entity';

/**
 * These tests exercise real PostgreSQL behavior (foreign keys, unique
 * constraints, check constraints) against an isolated test database — not
 * mocks, and not SQLite, since those cannot verify Postgres-specific
 * constraint enforcement.
 */
describe('Category schema (PostgreSQL integration)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await dataSource.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE TABLE "categories" CASCADE');
  });

  const repo = () => ds.getRepository(CategoryEntity);

  it('creates multiple root categories with a null parentId', async () => {
    const a = await repo().save(
      repo().create({ name: 'Điện thoại', slug: 'dien-thoai', parentId: null }),
    );
    const b = await repo().save(
      repo().create({ name: 'Laptop', slug: 'laptop', parentId: null }),
    );

    expect(a.parentId).toBeNull();
    expect(b.parentId).toBeNull();
  });

  it('creates multi-level child categories', async () => {
    const root = await repo().save(
      repo().create({
        name: 'Điện thoại',
        slug: 'dien-thoai-2',
        parentId: null,
      }),
    );
    const child = await repo().save(
      repo().create({ name: 'iPhone', slug: 'iphone', parentId: root.id }),
    );
    const grandchild = await repo().save(
      repo().create({
        name: 'iPhone 15',
        slug: 'iphone-15',
        parentId: child.id,
      }),
    );

    expect(child.parentId).toBe(root.id);
    expect(grandchild.parentId).toBe(child.id);
  });

  it('rejects a parentId that references a non-existent category', async () => {
    await expect(
      repo().save(
        repo().create({
          name: 'Không có cha hợp lệ',
          slug: 'invalid-parent-slug',
          parentId: '00000000-0000-0000-0000-000000000000',
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects a category being its own parent (check constraint)', async () => {
    const category = await repo().save(
      repo().create({ name: 'Tự làm cha', slug: 'self-parent-slug' }),
    );

    await expect(
      ds.query('UPDATE "categories" SET parent_id = $1 WHERE id = $1', [
        category.id,
      ]),
    ).rejects.toThrow();
  });

  it('rejects two categories sharing the same slug', async () => {
    await repo().save(repo().create({ name: 'Danh mục 1', slug: 'dup-slug' }));

    await expect(
      repo().save(repo().create({ name: 'Danh mục 2', slug: 'dup-slug' })),
    ).rejects.toThrow();
  });

  it('rejects slugs that only differ by case (dien-tu vs Dien-Tu)', async () => {
    await repo().save(repo().create({ name: 'Điện tử', slug: 'dien-tu' }));

    await expect(
      repo().save(repo().create({ name: 'Điện tử 2', slug: 'Dien-Tu' })),
    ).rejects.toThrow();
  });

  it('still allows genuinely different slugs to be created', async () => {
    const a = await repo().save(
      repo().create({ name: 'Điện tử', slug: 'dien-tu-unique' }),
    );
    const b = await repo().save(
      repo().create({ name: 'Thời trang', slug: 'thoi-trang-unique' }),
    );

    expect(a.slug).toBe('dien-tu-unique');
    expect(b.slug).toBe('thoi-trang-unique');
  });

  it('soft delete keeps the row in the database and reserves its slug', async () => {
    const category = await repo().save(
      repo().create({ name: 'Xoá mềm', slug: 'soft-delete-slug' }),
    );

    await repo().softDelete(category.id);

    const foundByDefault = await repo().findOne({
      where: { id: category.id },
    });
    expect(foundByDefault).toBeNull();

    const rawRow = await ds.query(
      'SELECT deleted_at FROM "categories" WHERE id = $1',
      [category.id],
    );
    expect(rawRow).toHaveLength(1);
    expect(rawRow[0].deleted_at).not.toBeNull();

    // Global unique slug: the soft-deleted row's slug cannot be reused.
    await expect(
      repo().save(
        repo().create({ name: 'Xoá mềm khác', slug: 'soft-delete-slug' }),
      ),
    ).rejects.toThrow();
  });

  it('does not allow reusing a soft-deleted slug even with different casing', async () => {
    const category = await repo().save(
      repo().create({ name: 'Xoá mềm', slug: 'soft-delete-case-slug' }),
    );

    await repo().softDelete(category.id);

    await expect(
      repo().save(
        repo().create({
          name: 'Xoá mềm khác',
          slug: 'Soft-Delete-Case-Slug',
        }),
      ),
    ).rejects.toThrow();
  });

  it('blocks hard-deleting a parent category that still has children', async () => {
    const parent = await repo().save(
      repo().create({ name: 'Danh mục cha', slug: 'parent-with-child' }),
    );
    await repo().save(
      repo().create({
        name: 'Danh mục con',
        slug: 'child-of-parent',
        parentId: parent.id,
      }),
    );

    await expect(
      ds.query('DELETE FROM "categories" WHERE id = $1', [parent.id]),
    ).rejects.toThrow();
  });

  it('stores and reads Vietnamese Unicode text correctly', async () => {
    const created = await repo().save(
      repo().create({
        name: 'Đồ gia dụng & Nhà bếp',
        slug: 'do-gia-dung-nha-bep',
        description: 'Sản phẩm gia dụng, nồi niêu xoong chảo, đồ dùng bếp.',
      }),
    );

    const found = await repo().findOneOrFail({ where: { id: created.id } });
    expect(found.name).toBe('Đồ gia dụng & Nhà bếp');
    expect(found.description).toBe(
      'Sản phẩm gia dụng, nồi niêu xoong chảo, đồ dùng bếp.',
    );
  });

  it('defaults displayOrder to 0 and isActive to true', async () => {
    const created = await repo().save(
      repo().create({ name: 'Mặc định', slug: 'defaults-slug' }),
    );
    const found = await repo().findOneOrFail({ where: { id: created.id } });

    expect(found.displayOrder).toBe(0);
    expect(found.isActive).toBe(true);
  });
});
