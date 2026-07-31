import { getMetadataArgsStorage } from 'typeorm';
import { CategoryEntity } from './category.entity';

describe('CategoryEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === CategoryEntity);
  const columns = storage.columns.filter((c) => c.target === CategoryEntity);
  const indices = storage.indices.filter((i) => i.target === CategoryEntity);
  const relations = storage.relations.filter(
    (r) => r.target === CategoryEntity,
  );
  const checks = storage.checks.filter((c) => c.target === CategoryEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(`Column ${propertyName} not found on CategoryEntity`);
    }
    return found;
  }

  it('maps to the "categories" table', () => {
    expect(table?.name).toBe('categories');
  });

  it('has a uuid primary key', () => {
    const idColumn = column('id');
    expect(idColumn.options.primary).toBe(true);
    expect(idColumn.options.type).toBe('uuid');
  });

  it('has a nullable parentId column (root categories have no parent)', () => {
    const parentIdColumn = column('parentId');
    expect(parentIdColumn.options.name).toBe('parent_id');
    expect(parentIdColumn.options.type).toBe('uuid');
    expect(parentIdColumn.options.nullable).toBe(true);
  });

  it('requires a name, allows Unicode via varchar', () => {
    const nameColumn = column('name');
    expect(nameColumn.options.type).toBe('varchar');
    expect(nameColumn.options.length).toBe(255);
    expect(nameColumn.options.nullable).toBeFalsy();
  });

  it('enforces a unique, required slug', () => {
    const slugColumn = column('slug');
    expect(slugColumn.options.unique).toBe(true);
    expect(slugColumn.options.nullable).toBeFalsy();
  });

  it('has a unique index backing slug lookups', () => {
    const slugIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'slug',
    );
    expect(slugIndex?.unique).toBe(true);
  });

  it('has optional description and imageUrl', () => {
    expect(column('description').options.nullable).toBe(true);
    expect(column('imageUrl').options.nullable).toBe(true);
    expect(column('imageUrl').options.name).toBe('image_url');
  });

  it('defaults displayOrder to 0', () => {
    const displayOrderColumn = column('displayOrder');
    expect(displayOrderColumn.options.name).toBe('display_order');
    expect(displayOrderColumn.options.default).toBe(0);
  });

  it('defaults isActive to true', () => {
    const isActiveColumn = column('isActive');
    expect(isActiveColumn.options.name).toBe('is_active');
    expect(isActiveColumn.options.default).toBe(true);
  });

  it('uses timestamptz for created/updated/deleted timestamps', () => {
    expect(column('createdAt').options.type).toBe('timestamptz');
    expect(column('updatedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.nullable).toBe(true);
  });

  it('has a composite (parent_id, display_order) index instead of separate ones', () => {
    const compositeIndex = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'parentId' &&
        i.columns[1] === 'displayOrder',
    );
    expect(compositeIndex).toBeDefined();

    // No redundant standalone index on parentId alone.
    const soleParentIdIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'parentId',
    );
    expect(soleParentIdIndex).toBeUndefined();
  });

  it('declares a self-referencing parent relation with RESTRICT and no eager load', () => {
    const parentRelation = relations.find((r) => r.propertyName === 'parent');
    expect(parentRelation?.options.onDelete).toBe('RESTRICT');
    expect(parentRelation?.options.eager).toBeFalsy();
    expect(parentRelation?.options.cascade).toBeFalsy();
  });

  it('declares a children relation with no eager load and no cascade', () => {
    const childrenRelation = relations.find(
      (r) => r.propertyName === 'children',
    );
    expect(childrenRelation).toBeDefined();
    expect(childrenRelation?.options.eager).toBeFalsy();
    expect(childrenRelation?.options.cascade).toBeFalsy();
  });

  it('has a check constraint preventing a category from being its own parent', () => {
    const selfParentCheck = checks.find(
      (c) => c.name === 'CHK_categories_parent_not_self',
    );
    expect(selfParentCheck?.expression).toContain('parent_id');
  });

  it('has a check constraint keeping display_order non-negative', () => {
    const displayOrderCheck = checks.find(
      (c) => c.name === 'CHK_categories_display_order_non_negative',
    );
    expect(displayOrderCheck?.expression).toContain('display_order');
  });
});
