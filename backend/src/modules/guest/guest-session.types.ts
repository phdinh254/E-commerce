import { GUEST_SESSION_SCHEMA_VERSION } from './guest.constants';

export type GuestSessionStatus = 'ACTIVE' | 'CLAIMING' | 'CLAIMED' | 'REVOKED';

export interface GuestSessionRecord {
  /** sha256 hash of the raw cookie value — never the raw value itself. */
  guestId: string;
  createdAt: string;
  lastSeenAt: string;
  status: GuestSessionStatus;
  claimedByUserId?: string;
  schemaVersion: number;
}

const STATUSES: readonly GuestSessionStatus[] = [
  'ACTIVE',
  'CLAIMING',
  'CLAIMED',
  'REVOKED',
];

/**
 * Refuses to trust Redis blindly: a value that is missing a field, has the
 * wrong type, or comes from a future/incompatible schema version is treated
 * as absent rather than coerced. Callers fall back to creating a fresh
 * session instead of risking a crash or misinterpreted record.
 */
export function isGuestSessionRecord(
  value: unknown,
): value is GuestSessionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.guestId === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.lastSeenAt === 'string' &&
    typeof record.status === 'string' &&
    STATUSES.includes(record.status as GuestSessionStatus) &&
    (record.claimedByUserId === undefined ||
      typeof record.claimedByUserId === 'string') &&
    record.schemaVersion === GUEST_SESSION_SCHEMA_VERSION
  );
}
