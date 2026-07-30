export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  appOrigin: string;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
}

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
  },
  database: {
    host: process.env.DATABASE_HOST as string,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    name: process.env.DATABASE_NAME as string,
    user: process.env.DATABASE_USER as string,
    password: process.env.DATABASE_PASSWORD ?? '',
    ssl: process.env.DATABASE_SSL === 'true',
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
});
