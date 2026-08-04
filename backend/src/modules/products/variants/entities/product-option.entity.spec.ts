import { getMetadataArgsStorage } from 'typeorm';
import { ProductOptionEntity } from './product-option.entity';

describe('ProductOptionEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === ProductOptionEntity);
  const columns = storage.columns.filter(
    (c) => c.target === ProductOptionEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductOptionEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductOptionEntity,
  );
  const checks = storage.checks.filter((c) => c.target === ProductOptionEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_options" table', () => {
    expect(table?.name).toBe('product_options');
  });

  it('requires a non-nullable productId', () => {
    expect(column('productId').options.name).toBe('product_id');
    expect(column('productId').options.nullable).toBeFalsy();
  });

  it('cascades on product delete (an option has no meaning without its product)', () => {
    const productRelation = relations.find((r) => r.propertyName === 'product');
    expect(productRelation?.options.onDelete).toBe('CASCADE');
    expect(productRelation?.options.eager).toBeFalsy();
  });

  it('has a unique (product_id, normalized_name) index', () => {
    const index = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'productId' &&
        i.columns[1] === 'normalizedName',
    );
    expect(index?.unique).toBe(true);
  });

  it('keeps normalizedName separate from the display name', () => {
    expect(column('name').options.length).toBe(100);
    expect(column('normalizedName').options.name).toBe('normalized_name');
  });

  it('has a check constraint keeping display_order non-negative', () => {
    const check = checks.find(
      (c) => c.name === 'CHK_product_options_display_order_non_negative',
    );
    expect(check?.expression).toContain('display_order');
  });
});
