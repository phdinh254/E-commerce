import { createPostgresConnectionOptions } from './database.config';
import { DatabaseConfig } from '../config/configuration';

function buildDbConfig(
  overrides: Partial<DatabaseConfig> = {},
): DatabaseConfig {
  return {
    host: 'localhost',
    port: 5432,
    name: 'ecommerce',
    user: 'ecommerce',
    password: 'secret',
    ssl: false,
    poolMax: 10,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 10000,
    ...overrides,
  };
}

describe('createPostgresConnectionOptions', () => {
  it('never enables synchronize, regardless of environment', () => {
    const options = createPostgresConnectionOptions(buildDbConfig());
    expect(options.synchronize).toBe(false);
  });

  it('applies default pool size and timeouts', () => {
    const options = createPostgresConnectionOptions(buildDbConfig());

    expect(options.extra).toEqual({
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  });

  it('propagates overridden pool size and timeouts', () => {
    const options = createPostgresConnectionOptions(
      buildDbConfig({
        poolMax: 25,
        connectionTimeoutMs: 2000,
        idleTimeoutMs: 30000,
      }),
    );

    expect(options.extra).toEqual({
      max: 25,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
    });
  });

  it('never disables certificate verification implicitly', () => {
    const options = createPostgresConnectionOptions(
      buildDbConfig({ ssl: true }),
    );
    // ssl: true (not an object with rejectUnauthorized: false) keeps
    // Node's default TLS certificate verification enabled.
    expect(options.ssl).toBe(true);
  });

  it('uses the shared snake_case naming strategy', () => {
    const options = createPostgresConnectionOptions(buildDbConfig());
    expect(options.namingStrategy?.constructor.name).toBe(
      'SnakeCaseNamingStrategy',
    );
  });
});
