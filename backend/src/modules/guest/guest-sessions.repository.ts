import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { GUEST_SESSION_REDIS_PREFIX } from './guest.constants';
import {
  GuestSessionRecord,
  isGuestSessionRecord,
} from './guest-session.types';

@Injectable()
export class GuestSessionsRepository {
  private readonly logger = new Logger(GuestSessionsRepository.name);

  constructor(private readonly redisService: RedisService) {}

  private key(guestId: string): string {
    return `${GUEST_SESSION_REDIS_PREFIX}${guestId}`;
  }

  /** Returns null for a missing key, a malformed value, or a schema the
   * current code does not recognize — never throws for bad Redis data. */
  async find(guestId: string): Promise<GuestSessionRecord | null> {
    const raw = await this.redisService.get(this.key(guestId));
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Discarding guest session with malformed JSON');
      return null;
    }
    if (!isGuestSessionRecord(parsed)) {
      this.logger.warn('Discarding guest session with unexpected schema');
      return null;
    }
    return parsed;
  }

  async save(record: GuestSessionRecord, ttlSeconds: number): Promise<void> {
    await this.redisService.set(
      this.key(record.guestId),
      JSON.stringify(record),
      ttlSeconds,
    );
  }

  async touchTtl(guestId: string, ttlSeconds: number): Promise<void> {
    await this.redisService.expire(this.key(guestId), ttlSeconds);
  }

  async delete(guestId: string): Promise<void> {
    await this.redisService.del(this.key(guestId));
  }

  /** Seconds remaining before this key expires, or null if it does not
   * exist / has no TTL set. */
  async ttlSeconds(guestId: string): Promise<number | null> {
    const ttl = await this.redisService.getClient().ttl(this.key(guestId));
    return ttl > 0 ? ttl : null;
  }
}
