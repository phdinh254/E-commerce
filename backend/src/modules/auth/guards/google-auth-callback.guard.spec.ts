import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthCallbackGuard } from './google-auth-callback.guard';
import { GOOGLE_OAUTH_STATE_COOKIE } from '../auth.constants';

function buildContext(options: {
  cookies?: Record<string, string>;
  query?: Record<string, string>;
}): ExecutionContext {
  const request = {
    cookies: options.cookies ?? {},
    query: options.query ?? {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function buildConfigService(isConfigured: boolean): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      clientId: isConfigured ? 'client-id' : '',
      clientSecret: isConfigured ? 'client-secret' : '',
      callbackUrl: isConfigured
        ? 'http://localhost:3000/api/v1/auth/google/callback'
        : '',
      isConfigured,
    }),
  } as unknown as ConfigService;
}

describe('GoogleAuthCallbackGuard', () => {
  it('throws ServiceUnavailableException when Google OAuth is not configured, before checking state', async () => {
    const guard = new GoogleAuthCallbackGuard(buildConfigService(false));
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects when the state cookie is missing', async () => {
    const guard = new GoogleAuthCallbackGuard(buildConfigService(true));
    const context = buildContext({ query: { state: 'abc' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'INVALID_OAUTH_STATE' },
    });
  });

  it('rejects when the query state does not match the cookie state', async () => {
    const guard = new GoogleAuthCallbackGuard(buildConfigService(true));
    const context = buildContext({
      cookies: { [GOOGLE_OAUTH_STATE_COOKIE]: 'expected-state' },
      query: { state: 'attacker-supplied-state' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the query is missing state entirely', async () => {
    const guard = new GoogleAuthCallbackGuard(buildConfigService(true));
    const context = buildContext({
      cookies: { [GOOGLE_OAUTH_STATE_COOKIE]: 'expected-state' },
      query: {},
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
