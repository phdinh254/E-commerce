import { ServiceUnavailableException } from '@nestjs/common';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestSessionsRepository } from './guest-sessions.repository';
import { GuestSessionRecord } from './guest-session.types';
import {
  GUEST_SESSION_ABSOLUTE_MAX_SECONDS,
  GUEST_SESSION_TTL_SECONDS,
} from './guest.constants';

function buildSession(
  overrides: Partial<GuestSessionRecord> = {},
): GuestSessionRecord {
  const now = new Date().toISOString();
  return {
    guestId: 'hash-1',
    createdAt: now,
    lastSeenAt: now,
    status: 'ACTIVE',
    schemaVersion: 1,
    ...overrides,
  };
}

describe('GuestSessionsService', () => {
  let repository: jest.Mocked<
    Pick<
      GuestSessionsRepository,
      'find' | 'save' | 'touchTtl' | 'delete' | 'ttlSeconds'
    >
  >;
  let service: GuestSessionsService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      touchTtl: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      ttlSeconds: jest.fn(),
    };
    service = new GuestSessionsService(
      repository as unknown as GuestSessionsRepository,
    );
  });

  describe('getOrCreateSession', () => {
    it('creates a new session when no raw token is presented', async () => {
      const result = await service.getOrCreateSession(undefined);
      expect(result.isNew).toBe(true);
      expect(result.rawToken).toHaveLength(64); // 32 bytes hex-encoded
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('reuses an existing ACTIVE session for a valid raw token', async () => {
      const existing = buildSession();
      repository.find.mockResolvedValue(existing);

      const result = await service.getOrCreateSession('some-raw-token');
      expect(result.isNew).toBe(false);
      expect(result.session).toBe(existing);
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.touchTtl).toHaveBeenCalledTimes(1);
    });

    it('creates a new session when the presented token does not resolve to anything', async () => {
      repository.find.mockResolvedValue(null);
      const result = await service.getOrCreateSession('stale-token');
      expect(result.isNew).toBe(true);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('creates a new session when the existing one is not ACTIVE (e.g. CLAIMED)', async () => {
      repository.find.mockResolvedValue(buildSession({ status: 'CLAIMED' }));
      const result = await service.getOrCreateSession('claimed-token');
      expect(result.isNew).toBe(true);
    });

    it('fails closed with ServiceUnavailableException when Redis errors, never granting access silently', async () => {
      repository.find.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        service.getOrCreateSession('some-token'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('touch — sliding expiration capped by absolute lifetime', () => {
    it('renews the TTL for a freshly created session', async () => {
      const createdAt = new Date().toISOString();
      await service.touch('guest-1', createdAt);
      expect(repository.touchTtl).toHaveBeenCalledWith(
        'guest-1',
        GUEST_SESSION_TTL_SECONDS,
      );
    });

    it('does not renew the TTL once the absolute lifetime has elapsed', async () => {
      const longAgo = new Date(
        Date.now() - (GUEST_SESSION_ABSOLUTE_MAX_SECONDS + 3600) * 1000,
      ).toISOString();
      await service.touch('guest-1', longAgo);
      expect(repository.touchTtl).not.toHaveBeenCalled();
    });

    it('caps the renewed TTL to the remaining absolute-lifetime budget near the ceiling', async () => {
      const almostAtCeiling = new Date(
        Date.now() - (GUEST_SESSION_ABSOLUTE_MAX_SECONDS - 100) * 1000,
      ).toISOString();
      await service.touch('guest-1', almostAtCeiling);
      const [, appliedTtl] = repository.touchTtl.mock.calls[0];
      expect(appliedTtl).toBeLessThanOrEqual(100);
      expect(appliedTtl).toBeGreaterThan(0);
    });
  });

  describe('revoke', () => {
    it('deletes the session', async () => {
      await service.revoke('guest-1');
      expect(repository.delete).toHaveBeenCalledWith('guest-1');
    });
  });
});
