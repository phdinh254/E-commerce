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

export type RefreshRotationOutcome =
  | { kind: 'success'; user: UserEntity }
  | { kind: 'invalid' }
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

  async deleteExpired(before: Date): Promise<void> {
    await this.repository.delete({ expiresAt: LessThan(before) });
  }

  /**
   * Atomically validates and rotates a refresh token: locks the presented
   * token's row with `SELECT ... FOR UPDATE` inside a single transaction, so
   * two concurrent requests presenting the same raw token are serialized on
   * that row instead of racing.
   *
   * The second (losing) request only ever sees the row after the first
   * request's transaction has committed — at which point it is already
   * revoked — and simply returns `{ kind: 'invalid' }` without touching any
   * other session. This is the fix for the previous design, which called
   * `revokeAllForUser` outside any lock whenever the conditional revoke
   * update affected zero rows; that could fire *after* the winning request
   * had already inserted its new token, wiping out a token that had just
   * been legitimately issued.
   *
   * Presenting a token that is expired but was never revoked is treated as
   * a distinct, unrelated case (not a concurrency artifact) and still
   * revokes every active session for that user, same as before.
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
        // Already used: either a genuine stale-token replay, or we lost a
        // concurrent rotation race and the winner already committed. Do
        // NOT escalate here — the winner's new token must survive.
        return { kind: 'invalid' };
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
          tokenHash: newToken.tokenHash,
          expiresAt: newToken.expiresAt,
        }),
      );

      return { kind: 'success', user };
    });
  }
}
