import { Injectable } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findById(id);
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role?: UserRole;
  }): Promise<UserEntity> {
    const user = this.usersRepository.create({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role ?? UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    return this.usersRepository.save(user);
  }

  isLoginAllowed(user: UserEntity): boolean {
    return user.status === UserStatus.ACTIVE;
  }

  markEmailVerified(id: string): Promise<void> {
    return this.usersRepository.markEmailVerified(id);
  }

  updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    return this.usersRepository.updatePasswordHash(id, passwordHash);
  }
}
