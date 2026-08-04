import { getMetadataArgsStorage } from 'typeorm';
import { ProductVariantChangeLogEntity } from './product-variant-change-log.entity';

describe('ProductVariantChangeLogEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find(
    (t) => t.target === ProductVariantChangeLogEntity,
  );
  const columns = storage.columns.filter(
    (c) => c.target === ProductVariantChangeLogEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductVariantChangeLogEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductVariantChangeLogEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_variant_change_logs" table', () => {
    expect(table?.name).toBe('product_variant_change_logs');
  });

  it('has no updatedAt/deletedAt column — the row is immutable by design', () => {
    expect(columns.find((c) => c.propertyName === 'updatedAt')).toBeUndefined();
    expect(columns.find((c) => c.propertyName === 'deletedAt')).toBeUndefined();
  });

  it('restricts deletion of the product/variant it describes (audit must outlive them)', () => {
    const productRelation = relations.find((r) => r.propertyName === 'product');
    const variantRelation = relations.find((r) => r.propertyName === 'variant');
    expect(productRelation?.options.onDelete).toBe('RESTRICT');
    expect(variantRelation?.options.onDelete).toBe('RESTRICT');
  });

  it('records actor as a foreign key to users, not a free-text field', () => {
    const actorRelation = relations.find((r) => r.propertyName === 'actor');
    expect(actorRelation?.options.onDelete).toBe('RESTRICT');
    expect(column('actorUserId').options.nullable).toBeFalsy();
  });

  it('has old/new/delta as plain integers and a bounded reason string', () => {
    expect(column('oldValue').options.type).toBe('integer');
    expect(column('newValue').options.type).toBe('integer');
    expect(column('delta').options.type).toBe('integer');
    expect(column('reason').options.length).toBe(500);
  });

  it('has a composite (variant_id, created_at) index for the audit read endpoint', () => {
    const index = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'variantId' &&
        i.columns[1] === 'createdAt',
    );
    expect(index).toBeDefined();
  });
});
