import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { GoogleOAuthConfig } from '../../../config/configuration';
import { extractOAuthStateCookie } from './google-auth.guard';

/**
 * Validates the CSRF `state` before ever invoking the Google strategy (which
 * would exchange the authorization code for tokens). A missing/mismatched
 * state is rejected outright — this is what stops an attacker from tricking
 * a victim into completing an OAuth flow the attacker initiated.
 */
@Injectable()
export class GoogleAuthCallbackGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const googleConfig = this.configService.get<GoogleOAuthConfig>(
      'google',
    ) as GoogleOAuthConfig;
    if (!googleConfig.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Đăng nhập bằng Google chưa được cấu hình trên máy chủ này',
      });
    }

    const req = context.switchToHttp().getRequest<Request>();
    const cookieState = extractOAuthStateCookie(req);
    const queryState =
      typeof req.query.state === 'string' ? req.query.state : undefined;

    if (!cookieState || !queryState || cookieState !== queryState) {
      throw new UnauthorizedException({
        code: 'INVALID_OAUTH_STATE',
        message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn',
      });
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
