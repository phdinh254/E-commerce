import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { CookieConfig, GoogleOAuthConfig } from '../../../config/configuration';
import { GOOGLE_OAUTH_STATE_COOKIE } from '../auth.constants';

const OAUTH_STATE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Initiates the Google OAuth redirect. Generates a random CSRF `state`,
 * stores it in a short-lived httpOnly cookie, and hands it to passport so
 * it round-trips through Google back to our callback — where
 * `GoogleAuthCallbackGuard` checks the two match before anything else runs.
 * There is no server session to store state in (this app is stateless
 * JWT), hence the cookie instead of the library's session-based default.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): {
    state: string;
    scope: string[];
  } {
    const googleConfig = this.configService.get<GoogleOAuthConfig>(
      'google',
    ) as GoogleOAuthConfig;
    if (!googleConfig.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Đăng nhập bằng Google chưa được cấu hình trên máy chủ này',
      });
    }

    const cookieConfig = this.configService.get<CookieConfig>(
      'cookie',
    ) as CookieConfig;
    const res = context.switchToHttp().getResponse<Response>();
    const state = randomBytes(32).toString('hex');
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieConfig.secure,
      domain: cookieConfig.domain,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
      path: '/',
    });
    return { state, scope: ['email', 'profile'] };
  }
}

/** Re-exported for the callback guard so both share exactly one cookie name. */
export function extractOAuthStateCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[GOOGLE_OAUTH_STATE_COOKIE];
}
