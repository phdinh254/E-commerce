import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UserStatus } from '../../common/enums/user-status.enum';

export interface NewRefreshTokenData {
  tokenHash: string;
  expiresAt: Date;
}

const REUSE_GRACE_WINDOW_MS = 250;

export type RefreshRotationOutcome =
  | { kind: 'success'; user: UserEntity }
  | { kind: 'invalid' }
  | { kind: 'reused' }
  | { kind: 'expired' }
  | { kind: 'inactive_user' };

@Injectable()
export class RefreshTokensRepository {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repository: Repository<RefreshTokenEntity>,
  ) {}

  create(data: Partial<RefreshTokenEntity>): RefreshTokenEntity {
    return this.repository.create(data);
  }

  save(token: RefreshTokenEntity): Promise<RefreshTokenEntity> {
    return this.repository.save(token);
  }

  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.repository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
  }

  /**
   * Revokes the token only if it is still active (revokedAt IS NULL).
   * Returns false if another request already revoked it first.
   */
  async revoke(id: string): Promise<boolean> {
    const result = await this.repository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async deleteExpired(before: Date): Promise<void> {
    await this.repository.delete({ expiresAt: LessThan(before) });
  }

  /**
   * Atomically validates and rotates a refresh token: locks the presented
   * token's row with `SELECT ... FOR UPDATE` inside a single transaction, so
   * two concurrent requests presenting the same raw token are serialized on
   * that row instead of racing.
   *
   * Presenting a token whose `revokedAt` is already set means some earlier
   * request already rotated it away. Two different situations look
   * identical at this point:
   *
   *  1. A genuine concurrent duplicate — two requests raced to rotate the
   *     exact same raw token (double-submit, network retry, multiple tabs).
   *     The pessimistic lock serializes them, so the loser simply observes
   *     the winner's commit microseconds later. The winner's brand-new
   *     token must survive untouched.
   *  2. Real reuse — a stale token (stolen cookie, replayed request) is
   *     presented well after the legitimate client already moved on to a
   *     later-generation token. This is the classic refresh-token-theft
   *     signal and must revoke the whole family, including whatever token
   *     is currently active in it.
   *
   * `REUSE_GRACE_WINDOW_MS` is how these are told apart: a re-presentation
   * within the window of the original rotation is treated as case 1 (no
   * escalation, matches the historical `{ kind: 'invalid' }` behavior this
   * table's concurrency tests already assert on); anything past it is
   * case 2. Legitimate rotation races settle well within this window even
   * under lock contention; a real replay happens on a wholly separate,
   * later request.
   *
   * Presenting a token that is expired but was never revoked is treated as
   * a distinct, unrelated case and still revokes every active session for
   * that user, same as before.
   */
  async rotate(
    tokenHash: string,
    newToken: NewRefreshTokenData,
  ): Promise<RefreshRotationOutcome> {
    return this.repository.manager.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(RefreshTokenEntity);

      const existing = await tokenRepo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        return { kind: 'invalid' };
      }

      if (existing.revokedAt) {
        const elapsedMs = Date.now() - existing.revokedAt.getTime();
        if (elapsedMs < REUSE_GRACE_WINDOW_MS) {
          return { kind: 'invalid' };
        }
        await tokenRepo.update(
          { familyId: existing.familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return { kind: 'reused' };
      }

      if (existing.expiresAt < new Date()) {
        await tokenRepo.update(
          { userId: existing.userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return { kind: 'expired' };
      }

      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.findOne({ where: { id: existing.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        await tokenRepo.update({ id: existing.id }, { revokedAt: new Date() });
        return { kind: 'inactive_user' };
      }

      await tokenRepo.update({ id: existing.id }, { revokedAt: new Date() });
      await tokenRepo.save(
        tokenRepo.create({
          userId: user.id,
          familyId: existing.familyId,
          tokenHash: newToken.tokenHash,
          expiresAt: newToken.expiresAt,
        }),
      );

      return { kind: 'success', user };
    });
  }
}
