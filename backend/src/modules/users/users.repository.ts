import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  create(data: Partial<UserEntity>): UserEntity {
    return this.repository.create(data);
  }

  save(user: UserEntity): Promise<UserEntity> {
    return this.repository.save(user);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.repository.update({ id }, { emailVerifiedAt: new Date() });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }
}
