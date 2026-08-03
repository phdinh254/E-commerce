import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { GuestSessionsRepository } from './guest-sessions.repository';
import { GuestSessionRecord } from './guest-session.types';
import {
  GUEST_SESSION_ABSOLUTE_MAX_SECONDS,
  GUEST_SESSION_SCHEMA_VERSION,
  GUEST_SESSION_TOKEN_BYTES,
  GUEST_SESSION_TTL_SECONDS,
} from './guest.constants';

export interface ResolvedGuestSession {
  session: GuestSessionRecord;
  /** The raw, unhashed cookie value — only ever returned to the caller
   * that must write it into a `Set-Cookie` header. Never stored anywhere;
   * only its hash (`session.guestId`) is persisted in Redis or Postgres. */
  rawToken: string;
  /** True when this call created a brand-new session (or replaced one that
   * turned out to be invalid) — signals the caller that a cookie needs to
   * be (re)issued. False when an existing valid cookie was simply reused. */
  isNew: boolean;
}

@Injectable()
export class GuestSessionsService {
  private readonly logger = new Logger(GuestSessionsService.name);

  constructor(private readonly repository: GuestSessionsRepository) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async createSession(): Promise<ResolvedGuestSession> {
    const rawToken = randomBytes(GUEST_SESSION_TOKEN_BYTES).toString('hex');
    const guestId = this.hashToken(rawToken);
    const now = new Date().toISOString();
    const session: GuestSessionRecord = {
      guestId,
      createdAt: now,
      lastSeenAt: now,
      status: 'ACTIVE',
      schemaVersion: GUEST_SESSION_SCHEMA_VERSION,
    };
    await this.repository.save(session, GUEST_SESSION_TTL_SECONDS);
    return { session, rawToken, isNew: true };
  }

  /**
   * Resolves the session for a presented raw cookie value, or creates a new
   * one. Never fails open: any Redis error propagates as
   * `ServiceUnavailableException` rather than silently granting/denying
   * access, so callers cannot accidentally treat a Redis outage as "no
   * guest, proceed anyway" for a route that actually requires an identity.
   */
  async getOrCreateSession(
    rawToken: string | undefined,
  ): Promise<ResolvedGuestSession> {
    try {
      if (!rawToken) {
        return this.createSession();
      }
      const guestId = this.hashToken(rawToken);
      const existing = await this.repository.find(guestId);
      if (!existing || existing.status !== 'ACTIVE') {
        return this.createSession();
      }
      await this.touch(existing.guestId, existing.createdAt);
      return { session: existing, rawToken, isNew: false };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Guest session store unavailable', error as Error);
      throw new ServiceUnavailableException({
        code: 'GUEST_SESSION_UNAVAILABLE',
        message: 'Không thể khởi tạo phiên khách vào lúc này',
      });
    }
  }

  async findByRawToken(rawToken: string): Promise<GuestSessionRecord | null> {
    return this.repository.find(this.hashToken(rawToken));
  }

  /**
   * Sliding-expiration renewal capped by an absolute lifetime: once
   * `GUEST_SESSION_ABSOLUTE_MAX_SECONDS` has elapsed since creation, the TTL
   * is no longer extended and the session expires on its own schedule —
   * an active guest cannot keep a session alive forever.
   */
  async touch(guestId: string, createdAtIso: string): Promise<void> {
    const ageSeconds = (Date.now() - new Date(createdAtIso).getTime()) / 1000;
    if (ageSeconds >= GUEST_SESSION_ABSOLUTE_MAX_SECONDS) return;
    const remainingBudget = GUEST_SESSION_ABSOLUTE_MAX_SECONDS - ageSeconds;
    const ttl = Math.max(
      1,
      Math.min(GUEST_SESSION_TTL_SECONDS, Math.floor(remainingBudget)),
    );
    await this.repository.touchTtl(guestId, ttl);
  }

  async revoke(guestId: string): Promise<void> {
    await this.repository.delete(guestId);
  }

  getTtlSeconds(guestId: string): Promise<number | null> {
    return this.repository.ttlSeconds(guestId);
  }
}
