import type { IncomingMessage, ServerResponse } from 'http';
import type { Request } from 'express';
import type { Params } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from '../middleware/request-id.middleware';
import { AppConfig, LoggerConfig } from '../../config/configuration';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'password_hash',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'token',
  'tokenHash',
  'token_hash',
  'clientSecret',
  'client_secret',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_PASSWORD',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
];

export function createPinoHttpOptions(
  appConfig: AppConfig,
  loggerConfig: LoggerConfig,
): PinoHttpOptions {
  const isDevelopment = appConfig.nodeEnv === 'development';

  return {
    level: loggerConfig.level,
    genReqId: (req) => {
      const request = req as Request;
      return (
        request.requestId ??
        resolveRequestId(request.headers[REQUEST_ID_HEADER])
      );
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: IncomingMessage) => ({
        id: req.id,
        method: req.method,
        url: typeof req.url === 'string' ? req.url.split('?')[0] : req.url,
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  };
}

export function createLoggerOptions(
  appConfig: AppConfig,
  loggerConfig: LoggerConfig,
): Params {
  return {
    pinoHttp: createPinoHttpOptions(appConfig, loggerConfig),
  };
}
