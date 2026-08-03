import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { VerificationTokensRepository } from './verification-tokens.repository';
import { OAuthIdentitiesRepository } from './oauth-identities.repository';
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
      | 'findByEmail'
      | 'findById'
      | 'markEmailVerified'
      | 'updatePasswordHash'
      | 'createOAuthUser'
    >
  >;
  let mailService: jest.Mocked<
    Pick<MailService, 'sendVerificationEmail' | 'sendPasswordResetEmail'>
  >;
  let verificationTokensRepository: jest.Mocked<
    Pick<VerificationTokensRepository, 'create' | 'save' | 'consume'>
  >;
  let refreshTokensRepository: jest.Mocked<
    Pick<RefreshTokensRepository, 'revokeAllForUser' | 'create' | 'save'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let oauthIdentitiesRepository: jest.Mocked<
    Pick<OAuthIdentitiesRepository, 'findByProviderAccount' | 'create' | 'save'>
  >;
  let configService: ConfigService;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePasswordHash: jest.fn(),
      createOAuthUser: jest.fn(),
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
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<
      Pick<RefreshTokensRepository, 'revokeAllForUser' | 'create' | 'save'>
    >;
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-access-token'),
    };
    oauthIdentitiesRepository = {
      findByProviderAccount: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<
      Pick<
        OAuthIdentitiesRepository,
        'findByProviderAccount' | 'create' | 'save'
      >
    >;
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
      jwtService as unknown as JwtService,
      configService,
      refreshTokensRepository as unknown as RefreshTokensRepository,
      verificationTokensRepository as unknown as VerificationTokensRepository,
      oauthIdentitiesRepository as unknown as OAuthIdentitiesRepository,
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

  describe('loginWithGoogle', () => {
    const googleProfile = {
      googleId: 'google-sub-123',
      email: 'newperson@example.com',
      emailVerified: true,
      fullName: 'New Person',
    };

    it('rejects a Google profile whose email is not verified', async () => {
      await expect(
        service.loginWithGoogle({ ...googleProfile, emailVerified: false }),
      ).rejects.toMatchObject({
        response: { code: 'GOOGLE_EMAIL_NOT_VERIFIED' },
      });
      expect(
        oauthIdentitiesRepository.findByProviderAccount,
      ).not.toHaveBeenCalled();
    });

    it('logs in as the already-linked user without creating anything new', async () => {
      const linkedUser = buildUser({ id: 'user-linked' });
      oauthIdentitiesRepository.findByProviderAccount.mockResolvedValue({
        id: 'identity-1',
        userId: linkedUser.id,
        user: linkedUser,
        provider: 'google',
        providerAccountId: googleProfile.googleId,
        email: googleProfile.email,
        createdAt: new Date(),
      });

      const result = await service.loginWithGoogle(googleProfile);

      expect(result.user.id).toBe(linkedUser.id);
      expect(usersService.createOAuthUser).not.toHaveBeenCalled();
    });

    it('creates a new CUSTOMER account and links it when no user has this email', async () => {
      oauthIdentitiesRepository.findByProviderAccount.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      const newUser = buildUser({
        id: 'user-new',
        email: googleProfile.email,
        passwordHash: null,
        emailVerifiedAt: new Date(),
      });
      usersService.createOAuthUser.mockResolvedValue(newUser);

      const result = await service.loginWithGoogle(googleProfile);

      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: googleProfile.email,
        fullName: googleProfile.fullName,
      });
      expect(oauthIdentitiesRepository.save).toHaveBeenCalledTimes(1);
      expect(result.user.id).toBe(newUser.id);
    });

    it('rejects (does not auto-link) when the Google email already belongs to a password account', async () => {
      oauthIdentitiesRepository.findByProviderAccount.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ email: googleProfile.email }),
      );

      await expect(
        service.loginWithGoogle(googleProfile),
      ).rejects.toMatchObject({
        response: { code: 'GOOGLE_EMAIL_ALREADY_REGISTERED' },
      });
      expect(usersService.createOAuthUser).not.toHaveBeenCalled();
    });
  });
});
