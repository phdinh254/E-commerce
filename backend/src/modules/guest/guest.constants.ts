export const GUEST_SESSION_COOKIE = 'guest_session';

/** Redis key namespace: `guest:session:<sha256(rawCookieValue)>`. */
export const GUEST_SESSION_REDIS_PREFIX = 'guest:session:';

export const GUEST_SESSION_TOKEN_BYTES = 32;

/** Initial and sliding-renewal TTL — matches the refresh token lifetime so
 * an anonymous session and a logged-in session behave similarly. */
export const GUEST_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Hard ceiling on total guest session lifetime regardless of activity —
 * sliding renewal (`touch`) never pushes a session past this many seconds
 * since it was first created. Prevents an active guest from living forever. */
export const GUEST_SESSION_ABSOLUTE_MAX_SECONDS = 30 * 24 * 60 * 60;

export const GUEST_SESSION_SCHEMA_VERSION = 1;
