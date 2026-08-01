import { getMetadataArgsStorage } from 'typeorm';
import { VerificationTokenEntity } from './verification-token.entity';

describe('VerificationTokenEntity metadata', () => {
  const storage = getMetadataArgsStorage();
  const table = storage.tables.find(
    (t) => t.target === VerificationTokenEntity,
  );
  const columns = storage.columns.filter(
    (c) => c.target === VerificationTokenEntity,
  );
  const indices = storage.indices.filter(
    (i) => i.target === VerificationTokenEntity,
  );
  const relations = storage.relations.filter(
    (r) => r.target === VerificationTokenEntity,
  );

  function column(propertyName: string) {
    const found = columns.find((c) => c.propertyName === propertyName);
    if (!found) {
      throw new Error(
        `Column ${propertyName} not found on VerificationTokenEntity`,
      );
    }
    return found;
  }

  it('maps to the "verification_tokens" table', () => {
    expect(table?.name).toBe('verification_tokens');
  });

  it('stores only a token hash, never the raw token', () => {
    const tokenHashColumn = column('tokenHash');
    expect(tokenHashColumn.options.name).toBe('token_hash');
    expect(columns.some((c) => c.propertyName === 'token')).toBe(false);
    expect(columns.some((c) => c.propertyName === 'rawToken')).toBe(false);
  });

  it('has a unique index on the token hash', () => {
    const tokenHashIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'tokenHash',
    );
    expect(tokenHashIndex?.unique).toBe(true);
  });

  it('indexes user_id', () => {
    const userIdIndex = indices.find(
      (i) => i.columns?.length === 1 && i.columns[0] === 'userId',
    );
    expect(userIdIndex).toBeDefined();
  });

  it('cascades deletes from user to its verification tokens', () => {
    const userRelation = relations.find((r) => r.propertyName === 'user');
    expect(userRelation?.options.onDelete).toBe('CASCADE');
  });

  it('has a nullable consumedAt for single-use enforcement', () => {
    expect(column('consumedAt').options.nullable).toBe(true);
  });

  it('has a purpose enum column distinguishing email-verification from password-reset', () => {
    expect(column('purpose').options.type).toBe('enum');
  });

  it('uses timestamptz for expiry and creation timestamps', () => {
    expect(column('expiresAt').options.type).toBe('timestamptz');
    expect(column('createdAt').options.type).toBe('timestamptz');
  });
});
