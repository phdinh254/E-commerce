import { getMetadataArgsStorage } from 'typeorm';
import { ProductEntity } from './product.entity';

describe('ProductEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === ProductEntity);
  const columns = storage.columns.filter((c) => c.target === ProductEntity);
  const indices = storage.indices.filter((i) => i.target === ProductEntity);
  const relations = storage.relations.filter((r) => r.target === ProductEntity);
  const checks = storage.checks.filter((c) => c.target === ProductEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(`Column ${propertyName} not found on ProductEntity`);
    }
    return found;
  }

  it('maps to the "products" table', () => {
    expect(table?.name).toBe('products');
  });

  it('has a uuid primary key', () => {
    const idColumn = column('id');
    expect(idColumn.options.primary).toBe(true);
    expect(idColumn.options.type).toBe('uuid');
  });

  it('requires a non-nullable categoryId', () => {
    const categoryIdColumn = column('categoryId');
    expect(categoryIdColumn.options.name).toBe('category_id');
    expect(categoryIdColumn.options.nullable).toBeFalsy();
  });

  it('declares a category relation with RESTRICT and no eager/cascade', () => {
    const categoryRelation = relations.find(
      (r) => r.propertyName === 'category',
    );
    expect(categoryRelation?.options.onDelete).toBe('RESTRICT');
    expect(categoryRelation?.options.nullable).toBe(false);
    expect(categoryRelation?.options.eager).toBeFalsy();
    expect(categoryRelation?.options.cascade).toBeFalsy();
  });

  it('requires a name, allows Unicode via varchar', () => {
    const nameColumn = column('name');
    expect(nameColumn.options.type).toBe('varchar');
    expect(nameColumn.options.length).toBe(255);
    expect(nameColumn.options.nullable).toBeFalsy();
  });

  it('requires a slug but relies on a functional lower(slug) unique index, not a plain unique flag', () => {
    const slugColumn = column('slug');
    expect(slugColumn.options.nullable).toBeFalsy();
    expect(slugColumn.options.unique).toBeFalsy();
    const slugIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'slug',
    );
    expect(slugIndex?.name).toBe('UQ_products_slug_lower');
    expect(slugIndex?.unique).toBe(true);
    expect(slugIndex?.synchronize).toBe(false);
  });

  it('requires an sku but relies on a functional upper(sku) unique index, not a plain unique flag', () => {
    const skuColumn = column('sku');
    expect(skuColumn.options.nullable).toBeFalsy();
    expect(skuColumn.options.unique).toBeFalsy();
    const skuIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'sku',
    );
    expect(skuIndex?.name).toBe('UQ_products_sku_upper');
    expect(skuIndex?.unique).toBe(true);
    expect(skuIndex?.synchronize).toBe(false);
  });

  it('stores price as a plain integer column (no float)', () => {
    const priceColumn = column('price');
    expect(priceColumn.options.type).toBe('integer');
  });

  it('has optional shortDescription, description, and thumbnailUrl', () => {
    expect(column('shortDescription').options.nullable).toBe(true);
    expect(column('description').options.nullable).toBe(true);
    expect(column('thumbnailUrl').options.nullable).toBe(true);
  });

  it('defaults isActive to true and isFeatured to false', () => {
    expect(column('isActive').options.default).toBe(true);
    expect(column('isFeatured').options.default).toBe(false);
  });

  it('defaults featuredOrder to 0', () => {
    expect(column('featuredOrder').options.default).toBe(0);
  });

  it('uses timestamptz for created/updated/deleted timestamps', () => {
    expect(column('createdAt').options.type).toBe('timestamptz');
    expect(column('updatedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.nullable).toBe(true);
  });

  it('has a check constraint keeping price non-negative', () => {
    const priceCheck = checks.find(
      (c) => c.name === 'CHK_products_price_non_negative',
    );
    expect(priceCheck?.expression).toContain('price');
  });

  it('has a composite (is_featured, featured_order) index for the landing query', () => {
    const compositeIndex = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'isFeatured' &&
        i.columns[1] === 'featuredOrder',
    );
    expect(compositeIndex).toBeDefined();
  });
});
