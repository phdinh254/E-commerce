import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * The single, discriminated shape every guard/handler in this codebase uses
 * to reason about "who is making this request" once identity resolution has
 * run. `kind` is the only thing callers should switch on — never infer
 * identity from which optional fields happen to be present.
 */
export type RequestPrincipal =
  | {
      kind: 'guest';
      guestId: string;
      roles: ['GUEST'];
    }
  | {
      kind: 'user';
      userId: string;
      roles: UserRole[];
      email: string;
    };

declare module 'express' {
  interface Request {
    /**
     * Set by `JwtAuthGuard` for every request that reaches a handler on a
     * route requiring at least guest-or-user access. Absent on `@Public()`
     * routes, which never resolve an identity at all.
     */
    principal?: RequestPrincipal;
    /**
     * Set by `JwtAuthGuard` only when a *new* (or rotated) guest session
     * was created for this request. `GuestCookieInterceptor` reads this to
     * decide whether to emit a `Set-Cookie` header — an existing, still
     * valid guest cookie is reused silently and this stays unset.
     */
    pendingGuestCookie?: { value: string; maxAgeSeconds: number };
  }
}
