import { envValidationSchema } from './env.validation';

interface ValidatedPoolEnv {
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_IDLE_TIMEOUT_MS: number;
}

function baseEnv(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    APP_ORIGIN: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:5173',
    DATABASE_HOST: 'localhost',
    DATABASE_NAME: 'ecommerce',
    DATABASE_USER: 'ecommerce',
    DATABASE_PASSWORD: 'password',
    REDIS_HOST: 'localhost',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    SMTP_HOST: 'localhost',
    SMTP_FROM: 'no-reply@example.com',
    ...overrides,
  };
}

describe('envValidationSchema (database pool settings)', () => {
  it('defaults DB_POOL_MAX, DB_CONNECTION_TIMEOUT_MS and DB_IDLE_TIMEOUT_MS when unset', () => {
    const { error, value } = envValidationSchema.validate(baseEnv(), {
      allowUnknown: true,
      abortEarly: false,
    }) as { error: unknown; value: ValidatedPoolEnv };

    expect(error).toBeUndefined();
    expect(value.DB_POOL_MAX).toBe(10);
    expect(value.DB_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(value.DB_IDLE_TIMEOUT_MS).toBe(10000);
  });

  it('accepts valid overrides', () => {
    const { error, value } = envValidationSchema.validate(
      baseEnv({
        DB_POOL_MAX: '25',
        DB_CONNECTION_TIMEOUT_MS: '2000',
        DB_IDLE_TIMEOUT_MS: '30000',
      }),
      { allowUnknown: true, abortEarly: false },
    ) as { error: unknown; value: ValidatedPoolEnv };

    expect(error).toBeUndefined();
    expect(value.DB_POOL_MAX).toBe(25);
    expect(value.DB_CONNECTION_TIMEOUT_MS).toBe(2000);
    expect(value.DB_IDLE_TIMEOUT_MS).toBe(30000);
  });

  it.each(['0', '-1', '101', 'not-a-number'])(
    'rejects an invalid DB_POOL_MAX value: %s',
    (invalid) => {
      const { error } = envValidationSchema.validate(
        baseEnv({ DB_POOL_MAX: invalid }),
        { allowUnknown: true, abortEarly: false },
      );

      expect(error).toBeDefined();
    },
  );

  it.each(['0', '-100', 'not-a-number'])(
    'rejects an invalid DB_CONNECTION_TIMEOUT_MS value: %s',
    (invalid) => {
      const { error } = envValidationSchema.validate(
        baseEnv({ DB_CONNECTION_TIMEOUT_MS: invalid }),
        { allowUnknown: true, abortEarly: false },
      );

      expect(error).toBeDefined();
    },
  );
});
