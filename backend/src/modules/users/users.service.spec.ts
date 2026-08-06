import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    fullName: 'Nguyen Van A',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    emailVerifiedAt: null,
    refreshTokens: [],
    addresses: [],
    ...overrides,
  };
}

describe('UsersService.updateProfile', () => {
  let repository: jest.Mocked<
    Pick<UsersRepository, 'updateFullName' | 'findById'>
  >;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      updateFullName: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
    service = new UsersService(repository as unknown as UsersRepository);
  });

  it('updates fullName and returns the refreshed user', async () => {
    repository.findById.mockResolvedValue(buildUser({ fullName: 'New Name' }));

    const result = await service.updateProfile('user-1', 'New Name');

    expect(repository.updateFullName).toHaveBeenCalledWith(
      'user-1',
      'New Name',
    );
    expect(result.fullName).toBe('New Name');
  });

  it('only ever calls updateFullName — a two-argument (id, fullName) API with no room for email/role/status/passwordHash', async () => {
    repository.findById.mockResolvedValue(buildUser());

    await service.updateProfile('user-1', 'New Name');

    expect(repository.updateFullName).toHaveBeenCalledTimes(1);
    expect(repository.updateFullName).toHaveBeenCalledWith(
      'user-1',
      'New Name',
    );
  });

  it('throws if the user cannot be reloaded after update', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.updateProfile('user-1', 'New Name')).rejects.toThrow(
      NotFoundException,
    );
  });
});
