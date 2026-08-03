import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthIdentityEntity } from './entities/oauth-identity.entity';

@Injectable()
export class OAuthIdentitiesRepository {
  constructor(
    @InjectRepository(OAuthIdentityEntity)
    private readonly repository: Repository<OAuthIdentityEntity>,
  ) {}

  findByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<OAuthIdentityEntity | null> {
    return this.repository.findOne({
      where: { provider, providerAccountId },
      relations: { user: true },
    });
  }

  create(data: Partial<OAuthIdentityEntity>): OAuthIdentityEntity {
    return this.repository.create(data);
  }

  save(identity: OAuthIdentityEntity): Promise<OAuthIdentityEntity> {
    return this.repository.save(identity);
  }
}
