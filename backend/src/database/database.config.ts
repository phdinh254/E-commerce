import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DatabaseConfig } from '../config/configuration';
import { SnakeCaseNamingStrategy } from './naming-strategy';

/**
 * Shared by the NestJS runtime (DatabaseModule) and the TypeORM CLI
 * (data-source.ts) so both connect with identical pool/timeout/naming
 * rules instead of drifting apart.
 */
export function createPostgresConnectionOptions(
  dbConfig: DatabaseConfig,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name,
    ssl: dbConfig.ssl,
    synchronize: false,
    namingStrategy: new SnakeCaseNamingStrategy(),
    extra: {
      max: dbConfig.poolMax,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMs,
      idleTimeoutMillis: dbConfig.idleTimeoutMs,
    },
  };
}
