import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationTokenEntity } from './entities/verification-token.entity';
import { UserEntity } from '../users/entities/user.entity';
import { VerificationTokenPurpose } from '../../common/enums/verification-token-purpose.enum';

export type ConsumeTokenOutcome =
  | { kind: 'success'; user: UserEntity }
  | { kind: 'invalid' }
  | { kind: 'expired' };

@Injectable()
export class VerificationTokensRepository {
  constructor(
    @InjectRepository(VerificationTokenEntity)
    private readonly repository: Repository<VerificationTokenEntity>,
  ) {}

  create(data: Partial<VerificationTokenEntity>): VerificationTokenEntity {
    return this.repository.create(data);
  }

  save(token: VerificationTokenEntity): Promise<VerificationTokenEntity> {
    return this.repository.save(token);
  }

  /**
   * Validates a presented raw token's hash for the given purpose and, if
   * valid, marks it consumed so it cannot be replayed. Never returns the
   * raw token or logs it — callers only ever see the outcome + user.
   */
  async consume(
    tokenHash: string,
    purpose: VerificationTokenPurpose,
  ): Promise<ConsumeTokenOutcome> {
    const existing = await this.repository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!existing) {
      return { kind: 'invalid' };
    }
    if (existing.purpose !== purpose) {
      return { kind: 'invalid' };
    }
    if (existing.consumedAt) {
      return { kind: 'invalid' };
    }
    if (existing.expiresAt < new Date()) {
      return { kind: 'expired' };
    }

    await this.repository.update(
      { id: existing.id },
      { consumedAt: new Date() },
    );

    return { kind: 'success', user: existing.user };
  }
}
