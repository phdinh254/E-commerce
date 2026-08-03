export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  appOrigin: string;
  corsOrigins: string[];
  frontendUrl: string;
  appName: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}

export const DEFAULT_DB_POOL_MAX = 10;
export const DEFAULT_DB_CONNECTION_TIMEOUT_MS = 5000;
export const DEFAULT_DB_IDLE_TIMEOUT_MS = 10000;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface CookieConfig {
  secure: boolean;
  domain?: string;
}

/**
 * `clientId`/`clientSecret` are empty strings when Google OAuth has not
 * been configured for this environment. Callers must check
 * `isConfigured` before starting the OAuth flow — passport-google-oauth20
 * requires non-empty strings just to construct the strategy, so the
 * module always registers it with a placeholder value and gates actual
 * use behind this flag instead of conditionally registering the module.
 */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  isConfigured: boolean;
}

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

export interface SupabaseConfig {
  url?: string;
  serviceRoleKey?: string;
  storageBucket?: string;
}

export type LogLevel =
  'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface LoggerConfig {
  level: LogLevel;
}

function defaultLogLevel(nodeEnv: string): LogLevel {
  if (nodeEnv === 'production') return 'info';
  if (nodeEnv === 'test') return 'silent';
  return 'debug';
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    appOrigin: process.env.APP_ORIGIN as string,
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    frontendUrl: process.env.FRONTEND_URL as string,
    appName: process.env.APP_NAME ?? 'E-commerce',
  },
  database: {
    host: process.env.DATABASE_HOST as string,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    name: process.env.DATABASE_NAME as string,
    user: process.env.DATABASE_USER as string,
    password: process.env.DATABASE_PASSWORD ?? '',
    ssl: process.env.DATABASE_SSL === 'true',
    poolMax: parseInt(
      process.env.DB_POOL_MAX ?? String(DEFAULT_DB_POOL_MAX),
      10,
    ),
    connectionTimeoutMs: parseInt(
      process.env.DB_CONNECTION_TIMEOUT_MS ??
        String(DEFAULT_DB_CONNECTION_TIMEOUT_MS),
      10,
    ),
    idleTimeoutMs: parseInt(
      process.env.DB_IDLE_TIMEOUT_MS ?? String(DEFAULT_DB_IDLE_TIMEOUT_MS),
      10,
    ),
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  } as RedisConfig,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
  } as CookieConfig,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
    isConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
  },
  mail: {
    host: process.env.SMTP_HOST as string,
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: process.env.SMTP_FROM as string,
  } as MailConfig,
  supabase: {
    url: process.env.SUPABASE_URL || undefined,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || undefined,
  } as SupabaseConfig,
  logger: {
    level:
      (process.env.LOG_LEVEL as LogLevel | undefined) ??
      defaultLogLevel(process.env.NODE_ENV ?? 'development'),
  },
});
