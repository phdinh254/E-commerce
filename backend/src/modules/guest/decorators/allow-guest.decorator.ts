import { SetMetadata } from '@nestjs/common';

export const ALLOW_GUEST_KEY = 'allowGuest';

/**
 * Opt-in policy: the route accepts either an authenticated user OR a guest
 * session, and `JwtAuthGuard` will create a guest session for a request
 * that has neither (unless Redis is unavailable, in which case it fails
 * closed with 503 — see `JwtAuthGuard`).
 *
 * Every other non-`@Public()` route keeps today's default: a valid access
 * token is mandatory, full stop. This decorator only ever *widens* access
 * on the specific routes that use it — it is never applied globally.
 */
export const AllowGuest = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_GUEST_KEY, true);
