import { getMetadataArgsStorage } from 'typeorm';
import { ProductOptionValueEntity } from './product-option-value.entity';

describe('ProductOptionValueEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find(
    (t) => t.target === ProductOptionValueEntity,
  );
  const columns = storage.columns.filter(
    (c) => c.target === ProductOptionValueEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === ProductOptionValueEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === ProductOptionValueEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) throw new Error(`Column ${propertyName} not found`);
    return found;
  }

  it('maps to the "product_option_values" table', () => {
    expect(table?.name).toBe('product_option_values');
  });

  it('requires a non-nullable optionId', () => {
    expect(column('optionId').options.name).toBe('option_id');
    expect(column('optionId').options.nullable).toBeFalsy();
  });

  it('cascades on option delete', () => {
    const optionRelation = relations.find((r) => r.propertyName === 'option');
    expect(optionRelation?.options.onDelete).toBe('CASCADE');
  });

  it('has a unique (option_id, normalized_value) index', () => {
    const index = indices.find(
      (i) =>
        Array.isArray(i.columns) &&
        i.columns.length === 2 &&
        i.columns[0] === 'optionId' &&
        i.columns[1] === 'normalizedValue',
    );
    expect(index?.unique).toBe(true);
  });
});
