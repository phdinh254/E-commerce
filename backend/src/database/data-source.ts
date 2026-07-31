import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  DatabaseConfig,
  DEFAULT_DB_CONNECTION_TIMEOUT_MS,
  DEFAULT_DB_IDLE_TIMEOUT_MS,
  DEFAULT_DB_POOL_MAX,
} from '../config/configuration';
import { createPostgresConnectionOptions } from './database.config';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const dbConfig: DatabaseConfig = {
  host: process.env.DATABASE_HOST as string,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  name: process.env.DATABASE_NAME as string,
  user: process.env.DATABASE_USER as string,
  password: process.env.DATABASE_PASSWORD ?? '',
  ssl: process.env.DATABASE_SSL === 'true',
  poolMax: parseInt(process.env.DB_POOL_MAX ?? String(DEFAULT_DB_POOL_MAX), 10),
  connectionTimeoutMs: parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS ??
      String(DEFAULT_DB_CONNECTION_TIMEOUT_MS),
    10,
  ),
  idleTimeoutMs: parseInt(
    process.env.DB_IDLE_TIMEOUT_MS ?? String(DEFAULT_DB_IDLE_TIMEOUT_MS),
    10,
  ),
};

export const dataSourceOptions: DataSourceOptions = {
  ...createPostgresConnectionOptions(dbConfig),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations_history',
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
