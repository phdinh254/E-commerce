import pino from 'pino';
import { Writable } from 'stream';
import type { IncomingMessage } from 'http';
import type { Options as PinoHttpOptions } from 'pino-http';
import { createPinoHttpOptions } from './logger.config';
import { AppConfig, LoggerConfig } from '../../config/configuration';

function buildAppConfig(nodeEnv: string): AppConfig {
  return {
    nodeEnv,
    port: 3000,
    apiPrefix: 'api',
    appOrigin: 'http://localhost:3000',
    corsOrigins: [],
  };
}

class CapturingStream extends Writable {
  lines: string[] = [];

  _write(
    chunk: Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(chunk.toString());
    callback();
  }

  get output(): string {
    return this.lines.join('');
  }
}

describe('createPinoHttpOptions', () => {
  it('enables pino-pretty transport in development', () => {
    const options = createPinoHttpOptions(buildAppConfig('development'), {
      level: 'debug',
    });

    expect(options.transport).toBeDefined();
    expect((options.transport as { target: string }).target).toBe(
      'pino-pretty',
    );
  });

  it('disables transport in production so logs stay single-line JSON', () => {
    const options = createPinoHttpOptions(buildAppConfig('production'), {
      level: 'info',
    });

    expect(options.transport).toBeUndefined();
  });

  it.each<[LoggerConfig['level'], string]>([
    ['debug', 'development'],
    ['info', 'production'],
    ['silent', 'test'],
  ])('propagates the %s log level for %s', (level, nodeEnv) => {
    const options = createPinoHttpOptions(buildAppConfig(nodeEnv), { level });
    expect(options.level).toBe(level);
  });

  it('produces single-line structured JSON output in production mode', () => {
    const options = createPinoHttpOptions(buildAppConfig('production'), {
      level: 'info',
    });
    const stream = new CapturingStream();
    const logger = pino(
      { level: options.level, redact: options.redact },
      stream,
    );

    logger.info({ msg: 'request completed' });

    const lines = stream.output.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(() => {
      JSON.parse(lines[0]);
    }).not.toThrow();
  });

  describe('redaction of sensitive data', () => {
    function logAndCapture(payload: Record<string, unknown>): string {
      const options = createPinoHttpOptions(buildAppConfig('production'), {
        level: 'info',
      });
      const stream = new CapturingStream();
      const logger = pino({ level: 'info', redact: options.redact }, stream);

      logger.info(payload);
      return stream.output;
    }

    it('redacts the Authorization header', () => {
      const output = logAndCapture({
        req: {
          headers: {
            authorization: 'Bearer TEST_AUTHORIZATION_MUST_NOT_APPEAR',
          },
        },
      });

      expect(output).not.toContain('TEST_AUTHORIZATION_MUST_NOT_APPEAR');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts the Cookie header', () => {
      const output = logAndCapture({
        req: {
          headers: {
            cookie: 'refresh_token=TEST_REFRESH_TOKEN_MUST_NOT_APPEAR',
          },
        },
      });

      expect(output).not.toContain('TEST_REFRESH_TOKEN_MUST_NOT_APPEAR');
    });

    it('redacts a top-level password field', () => {
      const output = logAndCapture({
        password: 'TEST_PASSWORD_MUST_NOT_APPEAR',
      });

      expect(output).not.toContain('TEST_PASSWORD_MUST_NOT_APPEAR');
    });

    it('redacts a nested refreshToken field', () => {
      const output = logAndCapture({
        user: { refreshToken: 'TEST_REFRESH_TOKEN_MUST_NOT_APPEAR' },
      });

      expect(output).not.toContain('TEST_REFRESH_TOKEN_MUST_NOT_APPEAR');
    });
  });

  describe('req serializer', () => {
    it('drops headers and query string, keeping only id/method/url path', () => {
      const options = createPinoHttpOptions(buildAppConfig('production'), {
        level: 'info',
      });
      const fakeReq = {
        id: 'req-1',
        method: 'GET',
        url: '/api/v1/auth/me?token=TEST_AUTHORIZATION_MUST_NOT_APPEAR',
        headers: {
          authorization: 'Bearer TEST_AUTHORIZATION_MUST_NOT_APPEAR',
        },
      } as unknown as IncomingMessage;
      const serialized: unknown = options.serializers?.req?.(fakeReq);

      expect(serialized).toEqual({
        id: 'req-1',
        method: 'GET',
        url: '/api/v1/auth/me',
      });
    });
  });

  describe('genReqId', () => {
    type GenReqIdArgs = Parameters<NonNullable<PinoHttpOptions['genReqId']>>;

    function fakeRequest(headers: Record<string, string>): GenReqIdArgs[0] {
      return { headers } as unknown as GenReqIdArgs[0];
    }

    it('reuses a valid client-supplied x-request-id', () => {
      const options = createPinoHttpOptions(buildAppConfig('production'), {
        level: 'info',
      });
      const req = fakeRequest({ 'x-request-id': 'client-supplied-id-123' });

      expect(options.genReqId?.(req, {} as GenReqIdArgs[1])).toBe(
        'client-supplied-id-123',
      );
    });

    it('reuses the id already assigned by RequestIdMiddleware over the header', () => {
      const options = createPinoHttpOptions(buildAppConfig('production'), {
        level: 'info',
      });
      const req = {
        headers: { 'x-request-id': 'header-value' },
        requestId: 'middleware-assigned-id',
      } as unknown as GenReqIdArgs[0];

      expect(options.genReqId?.(req, {} as GenReqIdArgs[1])).toBe(
        'middleware-assigned-id',
      );
    });

    it('generates a fresh id when the client header is malformed or too long', () => {
      const options = createPinoHttpOptions(buildAppConfig('production'), {
        level: 'info',
      });
      const req = fakeRequest({ 'x-request-id': 'a'.repeat(200) });

      const id = options.genReqId?.(req, {} as GenReqIdArgs[1]);
      expect(id).not.toBe('a'.repeat(200));
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });
});
