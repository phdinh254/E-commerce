import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestSessionsRepository } from './guest-sessions.repository';
import { GuestClaimsRepository } from './guest-claims.repository';
import {
  GUEST_CLAIM_HANDLERS,
  GuestClaimHandler,
} from './guest-claim-handler.interface';

export interface ClaimResult {
  claimed: boolean;
  /** False when this call found a pre-existing successful claim for the
   * same (guestId, userId) pair — a safe, idempotent replay. */
  isNewClaim: boolean;
}

const CLAIMED_TOMBSTONE_TTL_SECONDS = 5 * 60;

@Injectable()
export class GuestClaimService {
  private readonly logger = new Logger(GuestClaimService.name);

  constructor(
    private readonly guestSessionsService: GuestSessionsService,
    private readonly guestSessionsRepository: GuestSessionsRepository,
    private readonly guestClaimsRepository: GuestClaimsRepository,
    @Inject(GUEST_CLAIM_HANDLERS)
    private readonly claimHandlers: GuestClaimHandler[],
  ) {}

  /**
   * Called from the login/register flow with the *raw* guest cookie value
   * read directly off the request — never a guestId supplied by the client.
   * No-ops (returns `{claimed: false, isNewClaim: false}`) when there is no
   * guest cookie or the session it points to no longer exists; that is the
   * common case (most logins are not preceded by guest activity), not an
   * error.
   */
  async claimFromRawToken(
    rawGuestToken: string | undefined,
    userId: string,
  ): Promise<ClaimResult> {
    if (!rawGuestToken) return { claimed: false, isNewClaim: false };

    const session =
      await this.guestSessionsService.findByRawToken(rawGuestToken);
    // Even with no live Redis session (expired, already revoked, or this is
    // a retry after a prior successful claim already deleted it), the
    // guestId is still derivable from the raw token and the Postgres claim
    // table is authoritative — compute it the same way the service does.
    const guestId = session?.guestId ?? this.hashRawToken(rawGuestToken);

    return this.claim(guestId, userId);
  }

  private hashRawToken(rawToken: string): string {
    // Mirrors GuestSessionsService's private hashing so a session that has
    // already been deleted from Redis (e.g. a retried claim) can still be
    // identified consistently in the guest_claims table.
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async claim(guestId: string, userId: string): Promise<ClaimResult> {
    const outcome = await this.guestClaimsRepository.insertIfAbsent(
      guestId,
      userId,
    );

    if (outcome.kind === 'already-claimed') {
      if (outcome.claim.userId === userId) {
        return { claimed: true, isNewClaim: false };
      }
      this.logger.warn(
        `SECURITY: rejected claim of guest session already owned by another user (guestId hash present, userId=${userId})`,
      );
      throw new ForbiddenException({
        code: 'GUEST_SESSION_ALREADY_CLAIMED',
        message: 'Phiên khách này đã được liên kết với tài khoản khác',
      });
    }

    // We won the idempotent insert — run domain claim handlers (Cart, etc.)
    // exactly once. A handler failure aborts before anything is marked
    // done in Redis, but the Postgres row already exists, so a retry will
    // hit the `already-claimed` (same user) branch above and simply not
    // re-run handlers — callers must make handlers safe to skip on retry,
    // not safe to run twice.
    for (const handler of this.claimHandlers) {
      await handler.claim({ guestId, userId });
    }

    await this.markClaimedBestEffort(guestId, userId);
    return { claimed: true, isNewClaim: true };
  }

  private async markClaimedBestEffort(
    guestId: string,
    userId: string,
  ): Promise<void> {
    try {
      const session = await this.guestSessionsRepository.find(guestId);
      if (session) {
        await this.guestSessionsRepository.save(
          {
            ...session,
            status: 'CLAIMED',
            claimedByUserId: userId,
            lastSeenAt: new Date().toISOString(),
          },
          CLAIMED_TOMBSTONE_TTL_SECONDS,
        );
      }
    } catch (error) {
      // Non-fatal: the Postgres guest_claims row is the durable record of
      // this claim. Worst case, the stale Redis session lingers until its
      // own TTL — it can still resolve as an ordinary (now ownerless)
      // guest session, but never as elevated access to the claimed user's
      // account, since claiming never wrote any auth capability into Redis.
      this.logger.warn(
        'Failed to mark guest session CLAIMED in Redis after a successful Postgres claim',
        error as Error,
      );
    }
  }
}
