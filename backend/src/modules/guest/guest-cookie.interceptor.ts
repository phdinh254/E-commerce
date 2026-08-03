import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { CookieConfig } from '../../config/configuration';
import { GUEST_SESSION_COOKIE } from './guest.constants';

/**
 * The single place a guest cookie is ever written to a response.
 * `JwtAuthGuard` only populates `request.pendingGuestCookie` when it just
 * created (or replaced) a session — an existing valid cookie is reused
 * silently and this interceptor is a no-op for that request, so a browser
 * with an already-valid guest cookie never receives a redundant
 * `Set-Cookie` on every response.
 */
@Injectable()
export class GuestCookieInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest<Request>();
        const pending = request.pendingGuestCookie;
        if (!pending) return;

        const response = context.switchToHttp().getResponse<Response>();
        if (response.headersSent) return;

        const cookieConfig = this.configService.get<CookieConfig>(
          'cookie',
        ) as CookieConfig;
        response.cookie(GUEST_SESSION_COOKIE, pending.value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: cookieConfig.secure,
          domain: cookieConfig.domain,
          path: '/',
          maxAge: pending.maxAgeSeconds * 1000,
        });
      }),
    );
  }
}
