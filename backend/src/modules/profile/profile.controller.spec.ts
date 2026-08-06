import { ProfileController } from './profile.controller';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
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

describe('ProfileController', () => {
  let usersService: jest.Mocked<Pick<UsersService, 'updateProfile'>>;
  let controller: ProfileController;

  beforeEach(() => {
    usersService = { updateProfile: jest.fn() };
    controller = new ProfileController(usersService as unknown as UsersService);
  });

  it('updates using the current-user id from the JWT, not from the body', async () => {
    usersService.updateProfile.mockResolvedValue(buildUser({ fullName: 'B' }));

    await controller.update(
      { id: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER },
      { fullName: 'B' },
    );

    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', 'B');
  });

  it('returns a safe response with no passwordHash, refreshTokens, or addresses', async () => {
    usersService.updateProfile.mockResolvedValue(buildUser({ fullName: 'B' }));

    const result = await controller.update(
      { id: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER },
      { fullName: 'B' },
    );

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'B',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshTokens');
  });
});
