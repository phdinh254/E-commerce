import { getMetadataArgsStorage } from 'typeorm';
import { ProductVariantEntity } from './product-variant.entity';

describe('ProductVariantEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === ProductVariantEntity);
  const columns = storage.columns.filter(
    (c) => c.target === ProductVariantEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductVariantEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductVariantEntity,
  );
  const checks = storage.checks.filter(
    (c) => c.target === ProductVariantEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_variants" table', () => {
    expect(table?.name).toBe('product_variants');
  });

  it('cascades on product delete', () => {
    const productRelation = relations.find((r) => r.propertyName === 'product');
    expect(productRelation?.options.onDelete).toBe('CASCADE');
  });

  it('stores price and stock as plain integers (no float)', () => {
    expect(column('price').options.type).toBe('integer');
    expect(column('stock').options.type).toBe('integer');
    expect(column('stock').options.default).toBe(0);
  });

  it('defaults isActive to true', () => {
    expect(column('isActive').options.default).toBe(true);
  });

  it('has no deletedAt column (no variant-delete endpoint exists in Chapter 10)', () => {
    expect(columns.find((c) => c.propertyName === 'deletedAt')).toBeUndefined();
  });

  it('relies on a functional upper(sku) unique index documented via synchronize:false, not a plain unique flag', () => {
    const skuColumn = column('sku');
    expect(skuColumn.options.unique).toBeFalsy();
    const skuIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'sku',
    );
    expect(skuIndex?.name).toBe('UQ_product_variants_sku_upper');
    expect(skuIndex?.unique).toBe(true);
    expect(skuIndex?.synchronize).toBe(false);
  });

  it('has a unique (product_id, combination_key) index', () => {
    const index = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'productId' &&
        i.columns[1] === 'combinationKey',
    );
    expect(index?.unique).toBe(true);
  });

  it('has check constraints keeping price and stock non-negative', () => {
    expect(
      checks.find((c) => c.name === 'CHK_product_variants_price_non_negative')
        ?.expression,
    ).toContain('price');
    expect(
      checks.find((c) => c.name === 'CHK_product_variants_stock_non_negative')
        ?.expression,
    ).toContain('stock');
  });
});
