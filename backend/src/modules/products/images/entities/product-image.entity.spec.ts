import { getMetadataArgsStorage } from 'typeorm';
import { ProductImageEntity } from './product-image.entity';

describe('ProductImageEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === ProductImageEntity);
  const columns = storage.columns.filter(
    (c) => c.target === ProductImageEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductImageEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductImageEntity,
  );
  const checks = storage.checks.filter((c) => c.target === ProductImageEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_images" table', () => {
    expect(table?.name).toBe('product_images');
  });

  it('restricts delete on Product — deliberately NOT cascade (would orphan the Supabase object)', () => {
    const productRelation = relations.find((r) => r.propertyName === 'product');
    expect(productRelation?.options.onDelete).toBe('RESTRICT');
  });

  it('restricts delete on ProductVariant — same reason as Product', () => {
    const variantRelation = relations.find((r) => r.propertyName === 'variant');
    expect(variantRelation?.options.onDelete).toBe('RESTRICT');
  });

  it('variantId is nullable (Product-level image)', () => {
    expect(column('variantId').options.nullable).toBe(true);
  });

  it('has a soft-delete column', () => {
    expect(columns.find((c) => c.propertyName === 'deletedAt')).toBeDefined();
  });

  it('has a unique (storageBucket, objectPath) index', () => {
    const index = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns.includes('storageBucket') &&
        i.columns.includes('objectPath'),
    );
    expect(index?.unique).toBe(true);
  });

  it('has check constraints for positive size and non-negative display order', () => {
    expect(
      checks.find((c) => c.name === 'CHK_product_images_size_bytes_positive')
        ?.expression,
    ).toContain('size_bytes');
    expect(
      checks.find(
        (c) => c.name === 'CHK_product_images_display_order_non_negative',
      )?.expression,
    ).toContain('display_order');
  });

  it('createdBy is required (actor always known — only ADMIN can upload)', () => {
    expect(column('createdBy').options.nullable).toBeFalsy();
  });
});
