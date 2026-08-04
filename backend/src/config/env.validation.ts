import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  APP_ORIGIN: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
  DB_IDLE_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().required(),

  FRONTEND_URL: Joi.string().uri().required(),
  APP_NAME: Joi.string().default('E-commerce'),

  // Google OAuth is optional: leave all three unset/empty to disable
  // "Sign in with Google" entirely. If any is set, all three should be.
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().allow('').optional(),

  SUPABASE_URL: Joi.string().uri().allow('').optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional(),
  SUPABASE_STORAGE_BUCKET: Joi.string().allow('').optional(),

  PRODUCT_SEARCH_CACHE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  PRODUCT_FEATURED_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(300),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .when('NODE_ENV', {
      switch: [
        { is: 'production', then: Joi.string().default('info') },
        { is: 'test', then: Joi.string().default('silent') },
      ],
      otherwise: Joi.string().default('debug'),
    }),
});
