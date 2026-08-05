import { evaluateResetGuard, sanitizeDatabaseTarget } from './reset-guard';

function validInput(
  overrides: Partial<Parameters<typeof evaluateResetGuard>[0]> = {},
) {
  return {
    nodeEnv: 'test',
    allowDatabaseReset: 'true',
    argv: ['node', 'reset.ts', '--confirm-reset'],
    databaseName: 'ecommerce_test',
    allowlist: 'ecommerce_test',
    ...overrides,
  };
}

describe('evaluateResetGuard', () => {
  it('allows when every condition holds', () => {
    expect(evaluateResetGuard(validInput()).allowed).toBe(true);
  });

  it('rejects production NODE_ENV', () => {
    const result = evaluateResetGuard(validInput({ nodeEnv: 'production' }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/NODE_ENV/);
  });

  it('rejects an unset NODE_ENV', () => {
    const result = evaluateResetGuard(validInput({ nodeEnv: undefined }));
    expect(result.allowed).toBe(false);
  });

  it('rejects staging NODE_ENV by default', () => {
    const result = evaluateResetGuard(validInput({ nodeEnv: 'staging' }));
    expect(result.allowed).toBe(false);
  });

  it('rejects when ALLOW_DATABASE_RESET is not exactly "true"', () => {
    const result = evaluateResetGuard(
      validInput({ allowDatabaseReset: 'yes' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/ALLOW_DATABASE_RESET/);
  });

  it('rejects when --confirm-reset flag is missing', () => {
    const result = evaluateResetGuard(
      validInput({ argv: ['node', 'reset.ts'] }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/--confirm-reset/);
  });

  it('rejects when the allowlist is not configured at all', () => {
    const result = evaluateResetGuard(validInput({ allowlist: undefined }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/DB_RESET_ALLOWLIST/);
  });

  it('rejects a database name not present in the allowlist', () => {
    const result = evaluateResetGuard(
      validInput({
        databaseName: 'ecommerce_production',
        allowlist: 'ecommerce_test',
      }),
    );
    expect(result.allowed).toBe(false);
  });

  it('does not treat "database name contains dev/test" as sufficient on its own', () => {
    // A database literally named "ecommerce_test_but_not_allowlisted" must
    // still be rejected — allowlist membership is exact-match, not substring.
    const result = evaluateResetGuard(
      validInput({
        databaseName: 'ecommerce_test_but_not_allowlisted',
        allowlist: 'ecommerce_test',
      }),
    );
    expect(result.allowed).toBe(false);
  });

  it('requires ALL conditions simultaneously, not just one', () => {
    const result = evaluateResetGuard({
      nodeEnv: 'production',
      allowDatabaseReset: undefined,
      argv: [],
      databaseName: 'whatever',
      allowlist: undefined,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(4);
  });
});

describe('sanitizeDatabaseTarget', () => {
  it('never includes the password', () => {
    const target = sanitizeDatabaseTarget({
      host: 'localhost',
      port: 5433,
      name: 'ecommerce_test',
      user: 'ecommerce_test',
    });
    expect(target).toBe(
      'postgres://ecommerce_test@localhost:5433/ecommerce_test',
    );
    expect(target).not.toMatch(/password/i);
  });
});
