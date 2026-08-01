import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { VerificationTokensRepository } from './verification-tokens.repository';
import { VerificationTokenPurpose } from '../../common/enums/verification-token-purpose.enum';
import { UsersService } from '../users/users.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    fullName: 'Nguyễn Văn A',
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

describe('AuthService — email verification & password reset', () => {
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'findById' | 'markEmailVerified' | 'updatePasswordHash'
    >
  >;
  let mailService: jest.Mocked<
    Pick<MailService, 'sendVerificationEmail' | 'sendPasswordResetEmail'>
  >;
  let verificationTokensRepository: jest.Mocked<
    Pick<VerificationTokensRepository, 'create' | 'save' | 'consume'>
  >;
  let refreshTokensRepository: jest.Mocked<
    Pick<RefreshTokensRepository, 'revokeAllForUser'>
  >;
  let configService: ConfigService;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    verificationTokensRepository = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<VerificationTokensRepository, 'create' | 'save' | 'consume'>
    >;
    refreshTokensRepository = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt') {
          return {
            accessSecret: 'a'.repeat(32),
            accessExpiresIn: '15m',
            refreshSecret: 'b'.repeat(32),
            refreshExpiresIn: '7d',
          };
        }
        if (key === 'app') {
          return {
            frontendUrl: 'http://localhost:3001',
            appName: 'E-commerce',
          };
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AuthService(
      usersService as unknown as UsersService,
      {} as JwtService,
      configService,
      refreshTokensRepository as unknown as RefreshTokensRepository,
      verificationTokensRepository as unknown as VerificationTokensRepository,
      mailService as unknown as MailService,
    );
  });

  describe('requestEmailVerification', () => {
    it('sends a verification email with a URL built from FRONTEND_URL', async () => {
      const user = buildUser();
      await service.requestEmailVerification(user);

      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      const [to, fullName, url] =
        mailService.sendVerificationEmail.mock.calls[0];
      expect(to).toBe(user.email);
      expect(fullName).toBe(user.fullName);
      expect(url.startsWith('http://localhost:3001/verify-email?token=')).toBe(
        true,
      );
    });

    it('does not throw when mail delivery fails (registration must not fail)', async () => {
      mailService.sendVerificationEmail.mockRejectedValue(
        new Error('smtp down'),
      );
      const user = buildUser();
      await expect(
        service.requestEmailVerification(user),
      ).resolves.toBeUndefined();
    });
  });

  describe('verifyEmail', () => {
    it('marks the user verified when the token is valid', async () => {
      const user = buildUser();
      verificationTokensRepository.consume.mockResolvedValue({
        kind: 'success',
        user,
      });

      await service.verifyEmail('raw-token');

      expect(verificationTokensRepository.consume).toHaveBeenCalledWith(
        expect.any(String),
        VerificationTokenPurpose.EMAIL_VERIFICATION,
      );
      expect(usersService.markEmailVerified).toHaveBeenCalledWith(user.id);
    });

    it('throws UnauthorizedException with a stable code when the token is invalid or expired', async () => {
      verificationTokensRepository.consume.mockResolvedValue({
        kind: 'invalid',
      });

      await expect(service.verifyEmail('raw-token')).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_TOKEN' },
      });
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('issues a reset token and emails it when the account exists', async () => {
      const user = buildUser();
      usersService.findByEmail.mockResolvedValue(user);

      await service.requestPasswordReset(user.email);

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('does nothing observable when the account does not exist (no enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.requestPasswordReset('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password hash and revokes all sessions on a valid token', async () => {
      const user = buildUser();
      verificationTokensRepository.consume.mockResolvedValue({
        kind: 'success',
        user,
      });

      await service.resetPassword('raw-token', 'NewStrongPass123!');

      expect(usersService.updatePasswordHash).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
      );
      expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith(
        user.id,
      );
    });

    it('throws UnauthorizedException with a stable code on an invalid/expired token', async () => {
      verificationTokensRepository.consume.mockResolvedValue({
        kind: 'expired',
      });

      await expect(
        service.resetPassword('raw-token', 'NewStrongPass123!'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.updatePasswordHash).not.toHaveBeenCalled();
    });
  });
});
