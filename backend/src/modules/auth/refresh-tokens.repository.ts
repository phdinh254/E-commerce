import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

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

  async revoke(id: string): Promise<void> {
    await this.repository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
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
}
