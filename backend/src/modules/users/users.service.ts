import { Injectable, NotFoundException } from '@nestjs/common';
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

  async createOAuthUser(data: {
    email: string;
    fullName: string;
  }): Promise<UserEntity> {
    const user = this.usersRepository.create({
      email: data.email.toLowerCase(),
      passwordHash: null,
      fullName: data.fullName,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      // The provider (Google) has already verified this email address.
      emailVerifiedAt: new Date(),
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

  /** Ch18 profile update — allowlist of exactly `fullName`, enforced by
   * UpdateProfileDto at the controller boundary. Never touches email, role,
   * status, or passwordHash. */
  async updateProfile(id: string, fullName: string): Promise<UserEntity> {
    await this.usersRepository.updateFullName(id, fullName);
    const updated = await this.usersRepository.findById(id);
    if (!updated) {
      // Cannot happen in practice (id comes from a just-verified JWT
      // subject), but findById's return type is nullable — narrow it here
      // rather than asserting non-null at the call site.
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản',
      });
    }
    return updated;
  }
}
