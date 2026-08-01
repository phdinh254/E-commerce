import { getMetadataArgsStorage } from 'typeorm';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from '../../auth/entities/refresh-token.entity';

describe('UserEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === UserEntity);
  const columns = storage.columns.filter((c) => c.target === UserEntity);
  const indices = storage.indices.filter((i) => i.target === UserEntity);
  const relations = storage.relations.filter((r) => r.target === UserEntity);

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(`Column ${propertyName} not found on UserEntity`);
    }
    return found;
  }

  it('maps to the "users" table', () => {
    expect(table?.name).toBe('users');
  });

  it('has a uuid primary key', () => {
    const idColumn = column('id');
    expect(idColumn.options.primary).toBe(true);
    expect(idColumn.options.type).toBe('uuid');
  });

  it('enforces a unique email column', () => {
    const emailColumn = column('email');
    expect(emailColumn.options.unique).toBe(true);
    expect(emailColumn.options.type).toBe('varchar');
  });

  it('has a unique index backing email lookups', () => {
    const emailIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'email',
    );
    expect(emailIndex?.unique).toBe(true);
  });

  it('stores the password only as a hash column, never plaintext', () => {
    const passwordHashColumn = column('passwordHash');
    expect(passwordHashColumn.options.name).toBe('password_hash');
    expect(columns.some((c) => c.propertyName === 'password')).toBe(false);
  });

  it('uses timestamptz for created/updated/deleted timestamps', () => {
    expect(column('createdAt').options.type).toBe('timestamptz');
    expect(column('updatedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.type).toBe('timestamptz');
    expect(column('deletedAt').options.nullable).toBe(true);
  });

  it('has a nullable emailVerifiedAt timestamp — unverified users default to null', () => {
    expect(column('emailVerifiedAt').options.nullable).toBe(true);
    expect(column('emailVerifiedAt').options.type).toBe('timestamptz');
  });

  it('does not eager-load addresses (would otherwise be fetched on every user query)', () => {
    const addressesRelation = relations.find(
      (r) => r.propertyName === 'addresses',
    );
    expect(addressesRelation).toBeDefined();
    expect(addressesRelation?.options.eager).toBeFalsy();
    expect(addressesRelation?.options.cascade).toBeFalsy();
  });
});

describe('RefreshTokenEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find((t) => t.target === RefreshTokenEntity);
  const columns = storage.columns.filter(
    (c) => c.target === RefreshTokenEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === RefreshTokenEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === RefreshTokenEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(`Column ${propertyName} not found on RefreshTokenEntity`);
    }
    return found;
  }

  it('maps to the "refresh_tokens" table', () => {
    expect(table?.name).toBe('refresh_tokens');
  });

  it('stores only a token hash, never the raw refresh token', () => {
    const tokenHashColumn = column('tokenHash');
    expect(tokenHashColumn.options.name).toBe('token_hash');
    expect(columns.some((c) => c.propertyName === 'token')).toBe(false);
    expect(columns.some((c) => c.propertyName === 'rawToken')).toBe(false);
  });

  it('has a unique index on the token hash for fast, safe lookups', () => {
    const tokenHashIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'tokenHash',
    );
    expect(tokenHashIndex?.unique).toBe(true);
  });

  it('indexes user_id for revoke-all-sessions queries', () => {
    const userIdIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'userId',
    );
    expect(userIdIndex).toBeDefined();
  });

  it('cascades deletes from user to its refresh tokens, avoiding orphan sessions', () => {
    const userRelation = relations.find((r) => r.propertyName === 'user');
    expect(userRelation?.options.onDelete).toBe('CASCADE');
  });

  it('has no updatedAt/deletedAt column — sessions expire/revoke, they do not soft-delete', () => {
    expect(columns.some((c) => c.propertyName === 'updatedAt')).toBe(false);
    expect(columns.some((c) => c.propertyName === 'deletedAt')).toBe(false);
    expect(column('revokedAt').options.nullable).toBe(true);
    expect(column('expiresAt').options.type).toBe('timestamptz');
  });
});
