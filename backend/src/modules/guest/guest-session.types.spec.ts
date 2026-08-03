import { isGuestSessionRecord } from './guest-session.types';
import { GUEST_SESSION_SCHEMA_VERSION } from './guest.constants';

function validRecord() {
  return {
    guestId: 'a'.repeat(64),
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    status: 'ACTIVE' as const,
    schemaVersion: GUEST_SESSION_SCHEMA_VERSION,
  };
}

describe('isGuestSessionRecord', () => {
  it('accepts a well-formed record', () => {
    expect(isGuestSessionRecord(validRecord())).toBe(true);
  });

  it('accepts a record with claimedByUserId set', () => {
    expect(
      isGuestSessionRecord({ ...validRecord(), claimedByUserId: 'user-1' }),
    ).toBe(true);
  });

  it.each([null, undefined, 'a string', 42, []])(
    'rejects non-object input: %p',
    (input) => {
      expect(isGuestSessionRecord(input)).toBe(false);
    },
  );

  it('rejects a record missing a required field', () => {
    const record = validRecord();
    const { createdAt, lastSeenAt, status, schemaVersion } = record;
    expect(
      isGuestSessionRecord({ createdAt, lastSeenAt, status, schemaVersion }),
    ).toBe(false);
  });

  it('rejects an unknown status value', () => {
    expect(isGuestSessionRecord({ ...validRecord(), status: 'DELETED' })).toBe(
      false,
    );
  });

  it('rejects a mismatched schema version (future/incompatible schema)', () => {
    expect(isGuestSessionRecord({ ...validRecord(), schemaVersion: 999 })).toBe(
      false,
    );
  });

  it('rejects a non-string claimedByUserId', () => {
    expect(
      isGuestSessionRecord({ ...validRecord(), claimedByUserId: 12345 }),
    ).toBe(false);
  });
});
