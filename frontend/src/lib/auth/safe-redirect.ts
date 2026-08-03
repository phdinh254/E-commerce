const DEFAULT_REDIRECT = "/account";

/**
 * Only ever returns a same-origin, path-only destination. `redirect` query
 * params are attacker-controllable (they end up in login/register links),
 * so anything that could point off-site — an absolute URL, a
 * protocol-relative `//host` path, or a `javascript:`/other scheme — falls
 * back to the default instead of ever being handed to `router.push`.
 */
export function getSafeRedirectPath(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_REDIRECT;
  if (raw.includes("://")) return DEFAULT_REDIRECT;
  return raw;
}
