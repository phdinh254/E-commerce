import { getMetadataArgsStorage } from 'typeorm';
import { AddressEntity } from './address.entity';

describe('AddressEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === AddressEntity);
  const columns = storage.columns.filter((c) => c.target === AddressEntity);
  const indices = storage.indices.filter((i) => i.target === AddressEntity);
  const relations = storage.relations.filter((r) => r.target === AddressEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(`Column ${propertyName} not found on AddressEntity`);
    }
    return found;
  }

  it('maps to the "addresses" table', () => {
    expect(table?.name).toBe('addresses');
  });

  it('has a uuid primary key', () => {
    const idColumn = column('id');
    expect(idColumn.options.primary).toBe(true);
    expect(idColumn.options.type).toBe('uuid');
  });

  it('requires a userId column', () => {
    const userIdColumn = column('userId');
    expect(userIdColumn.options.name).toBe('user_id');
    expect(userIdColumn.options.type).toBe('uuid');
    expect(userIdColumn.options.nullable).toBeFalsy();
  });

  it('has an optional label column', () => {
    expect(column('label').options.nullable).toBe(true);
    expect(column('label').options.type).toBe('varchar');
  });

  it('requires recipientName, phoneNumber, and the address fields', () => {
    expect(column('recipientName').options.name).toBe('recipient_name');
    expect(column('recipientName').options.nullable).toBeFalsy();
    expect(column('phoneNumber').options.name).toBe('phone_number');
    expect(column('phoneNumber').options.nullable).toBeFalsy();
    expect(column('province').options.nullable).toBeFalsy();
    expect(column('district').options.nullable).toBeFalsy();
    expect(column('ward').options.nullable).toBeFalsy();
    expect(column('streetAddress').options.name).toBe('street_address');
    expect(column('streetAddress').options.nullable).toBeFalsy();
  });

  it('defaults isDefault to false', () => {
    const isDefaultColumn = column('isDefault');
    expect(isDefaultColumn.options.name).toBe('is_default');
    expect(isDefaultColumn.options.default).toBe(false);
  });

  it('uses timestamptz for created/updated/deleted timestamps, deletedAt nullable', () => {
    expect(column('createdAt').options.type).toBe('timestamptz');
    expect(column('updatedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.nullable).toBe(true);
  });

  it("has a plain index on user_id for listing a user's addresses", () => {
    const userIdIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'userId' && !i.where,
    );
    expect(userIdIndex).toBeDefined();
    expect(userIdIndex?.unique).toBeFalsy();
  });

  it('has a partial unique index enforcing at most one active default address per user', () => {
    const defaultIndex = indices.find(
      (i) => i.name === 'UQ_addresses_user_default_active',
    );
    expect(defaultIndex).toBeDefined();
    expect(defaultIndex?.unique).toBe(true);
    expect(defaultIndex?.columns).toEqual(['userId']);
    expect(defaultIndex?.where).toContain('is_default');
    expect(defaultIndex?.where).toContain('deleted_at');
  });

  it('declares a required-user relation with no eager load and no cascade', () => {
    const userRelation = relations.find((r) => r.propertyName === 'user');
    expect(userRelation).toBeDefined();
    expect(userRelation?.options.onDelete).toBe('RESTRICT');
    expect(userRelation?.options.eager).toBeFalsy();
    expect(userRelation?.options.cascade).toBeFalsy();
  });
});
