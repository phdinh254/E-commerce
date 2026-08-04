import { getMetadataArgsStorage } from 'typeorm';
import { ProductAttributeEntity } from './product-attribute.entity';

describe('ProductAttributeEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === ProductAttributeEntity);
  const columns = storage.columns.filter(
    (c) => c.target === ProductAttributeEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductAttributeEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductAttributeEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_attributes" table', () => {
    expect(table?.name).toBe('product_attributes');
  });

  it('cascades on product delete', () => {
    const productRelation = relations.find((r) => r.propertyName === 'product');
    expect(productRelation?.options.onDelete).toBe('CASCADE');
  });

  it('has isVisible defaulting to true and a soft-delete column', () => {
    expect(column('isVisible').options.default).toBe(true);
    expect(column('deletedAt').options.nullable).toBe(true);
  });

  it('has optional unit', () => {
    expect(column('unit').options.nullable).toBe(true);
  });

  it('documents the partial unique index (active rows only) via synchronize:false', () => {
    const index = indices.find(
      (i) =>
        i.name === 'UQ_product_attributes_product_id_normalized_name_active',
    );
    expect(index?.unique).toBe(true);
    expect(index?.synchronize).toBe(false);
  });
});
