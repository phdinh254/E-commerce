import { ForbiddenException } from '@nestjs/common';
import { GuestClaimService } from './guest-claim.service';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestSessionsRepository } from './guest-sessions.repository';
import { GuestClaimsRepository } from './guest-claims.repository';
import { GuestClaimHandler } from './guest-claim-handler.interface';
import { GuestClaimEntity } from './entities/guest-claim.entity';

function buildClaim(
  overrides: Partial<GuestClaimEntity> = {},
): GuestClaimEntity {
  return {
    id: 'claim-1',
    guestId: 'guest-hash-1',
    userId: 'user-1',
    claimedAt: new Date(),
    user: undefined as never,
    ...overrides,
  };
}

describe('GuestClaimService', () => {
  let guestSessionsService: jest.Mocked<
    Pick<GuestSessionsService, 'findByRawToken'>
  >;
  let guestSessionsRepository: jest.Mocked<
    Pick<GuestSessionsRepository, 'find' | 'save'>
  >;
  let guestClaimsRepository: jest.Mocked<
    Pick<GuestClaimsRepository, 'insertIfAbsent'>
  >;
  let claimHandlerMock: jest.Mock;
  let handlers: GuestClaimHandler[];
  let service: GuestClaimService;

  beforeEach(() => {
    guestSessionsService = { findByRawToken: jest.fn() };
    guestSessionsRepository = { find: jest.fn(), save: jest.fn() };
    guestClaimsRepository = { insertIfAbsent: jest.fn() };
    claimHandlerMock = jest.fn().mockResolvedValue(undefined);
    handlers = [{ claim: claimHandlerMock }];
    service = new GuestClaimService(
      guestSessionsService as unknown as GuestSessionsService,
      guestSessionsRepository as unknown as GuestSessionsRepository,
      guestClaimsRepository as unknown as GuestClaimsRepository,
      handlers,
    );
  });

  describe('claim', () => {
    it('runs claim handlers and marks the guest session CLAIMED on a winning (new) claim', async () => {
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        claim: buildClaim(),
      });
      guestSessionsRepository.find.mockResolvedValue({
        guestId: 'guest-hash-1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'ACTIVE',
        schemaVersion: 1,
      });

      const result = await service.claim('guest-hash-1', 'user-1');

      expect(result).toEqual({ claimed: true, isNewClaim: true });
      expect(claimHandlerMock).toHaveBeenCalledWith({
        guestId: 'guest-hash-1',
        userId: 'user-1',
      });
      expect(guestSessionsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CLAIMED',
          claimedByUserId: 'user-1',
        }),
        expect.any(Number),
      );
    });

    it('is idempotent: the same user claiming again does not re-run handlers', async () => {
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'already-claimed',
        claim: buildClaim({ userId: 'user-1' }),
      });

      const result = await service.claim('guest-hash-1', 'user-1');

      expect(result).toEqual({ claimed: true, isNewClaim: false });
      expect(claimHandlerMock).not.toHaveBeenCalled();
    });

    it('rejects a different user claiming an already-claimed guest session, and does not run handlers', async () => {
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'already-claimed',
        claim: buildClaim({ userId: 'original-owner' }),
      });

      await expect(
        service.claim('guest-hash-1', 'attacker'),
      ).rejects.toMatchObject({
        response: { code: 'GUEST_SESSION_ALREADY_CLAIMED' },
      });
      await expect(
        service.claim('guest-hash-1', 'attacker'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(claimHandlerMock).not.toHaveBeenCalled();
    });

    it('propagates a handler failure without marking the session CLAIMED, so a retry can safely try again', async () => {
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        claim: buildClaim(),
      });
      claimHandlerMock.mockRejectedValue(new Error('cart merge failed'));

      await expect(service.claim('guest-hash-1', 'user-1')).rejects.toThrow(
        'cart merge failed',
      );
      expect(guestSessionsRepository.save).not.toHaveBeenCalled();
    });

    it('does not fail the whole claim if marking the Redis session CLAIMED errors afterward', async () => {
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'inserted',
        claim: buildClaim(),
      });
      guestSessionsRepository.find.mockRejectedValue(new Error('redis down'));

      await expect(service.claim('guest-hash-1', 'user-1')).resolves.toEqual({
        claimed: true,
        isNewClaim: true,
      });
    });
  });

  describe('claimFromRawToken', () => {
    it('no-ops when there is no raw guest token', async () => {
      const result = await service.claimFromRawToken(undefined, 'user-1');
      expect(result).toEqual({ claimed: false, isNewClaim: false });
      expect(guestClaimsRepository.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('still resolves a guestId and attempts the claim even if the Redis session is already gone (retry case)', async () => {
      guestSessionsService.findByRawToken.mockResolvedValue(null);
      guestClaimsRepository.insertIfAbsent.mockResolvedValue({
        kind: 'already-claimed',
        claim: buildClaim({ userId: 'user-1' }),
      });

      const result = await service.claimFromRawToken('raw-token', 'user-1');
      expect(result).toEqual({ claimed: true, isNewClaim: false });
    });
  });
});
