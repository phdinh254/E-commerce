import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { ALLOW_GUEST_KEY } from '../../guest/decorators/allow-guest.decorator';
import { GuestSessionsService } from '../../guest/guest-sessions.service';
import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_TTL_SECONDS,
} from '../../guest/guest.constants';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Global authentication gate. Three route policies:
 *
 *  - `@Public()` — no principal resolved at all (unchanged).
 *  - Bare route (no `@AllowGuest()`, no `@Roles()`) — unchanged strict
 *    default: a valid access token is mandatory, full stop. A guest cookie
 *    is never even looked at. This is what keeps e.g. `GET /auth/me`
 *    exactly as strict as before this chapter.
 *  - `@AllowGuest()` and/or `@Roles(...)` — "principal-aware": an existing
 *    guest cookie is recognized (read only, never created) so `RolesGuard`
 *    can correctly answer 403 ("a principal exists, it's just not
 *    sufficient") instead of 401 ("no principal at all"). `@AllowGuest()`
 *    additionally creates a *new* guest session when neither a token nor
 *    an existing cookie is present, instead of rejecting.
 *
 * In every case, a *present but invalid* access token is always rejected
 * outright (see `handleRequest`) — never silently downgraded to guest,
 * since that would hide a real authentication failure.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly guestSessionsService: GuestSessionsService,
  ) {
    super();
  }

  private isAllowGuest(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(ALLOW_GUEST_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  private hasRolesMetadata(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) !== undefined
    );
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (user) return user;

    if (this.isMissingTokenInfo(info)) {
      // No token presented at all — tolerated at the passport layer for
      // every route; canActivate decides per-route whether that is enough.
      return undefined as unknown as TUser;
    }

    // A token WAS presented but failed verification (expired, malformed,
    // wrong signature) — always a hard failure, on every route. Never
    // falls through to guest resolution: a tampered token can never
    // masquerade as "just no token, treat me as a guest".
    throw (err as Error | undefined) || new UnauthorizedException();
  }

  private isMissingTokenInfo(info: unknown): boolean {
    return info instanceof Error && info.message === 'No auth token';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowGuest = this.isAllowGuest(context);
    const principalAware = allowGuest || this.hasRolesMetadata(context);

    await super.canActivate(context);

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (user) {
      request.principal = {
        kind: 'user',
        userId: user.id,
        roles: [user.role],
        email: user.email,
      };
      return true;
    }

    if (!principalAware) {
      // Bare route: no token and no guest fallback at all — unchanged
      // strict default. (handleRequest already returned undefined only
      // because the token was entirely absent; a bare route simply never
      // tolerates that.)
      throw new UnauthorizedException();
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    const rawGuestToken = cookies?.[GUEST_SESSION_COOKIE];

    if (!allowGuest) {
      // Roles-gated but not guest-creating: recognize an existing guest
      // cookie (so RolesGuard can 403 it) without ever writing to Redis —
      // an admin/staff-only route must not spawn guest sessions.
      if (!rawGuestToken) {
        throw new UnauthorizedException();
      }
      const existing =
        await this.guestSessionsService.findByRawToken(rawGuestToken);
      if (!existing || existing.status !== 'ACTIVE') {
        throw new UnauthorizedException();
      }
      request.principal = {
        kind: 'guest',
        guestId: existing.guestId,
        roles: ['GUEST'],
      };
      return true;
    }

    const { session, rawToken, isNew } =
      await this.guestSessionsService.getOrCreateSession(rawGuestToken);

    request.principal = {
      kind: 'guest',
      guestId: session.guestId,
      roles: ['GUEST'],
    };
    if (isNew) {
      request.pendingGuestCookie = {
        value: rawToken,
        maxAgeSeconds: GUEST_SESSION_TTL_SECONDS,
      };
    }
    return true;
  }
}
