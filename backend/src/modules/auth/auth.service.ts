import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AppConfig, JwtConfig } from '../../config/configuration';
import { parseDurationToSeconds } from '../../common/utils/duration.util';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { VerificationTokenPurpose } from '../../common/enums/verification-token-purpose.enum';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { VerificationTokensRepository } from './verification-tokens.repository';
import { MailService } from '../../infrastructure/mail/mail.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from './auth.constants';

export interface RefreshTokenIssueResult {
  rawToken: string;
  expiresAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: UserEntity;
}

const REFRESH_TOKEN_BYTES = 64;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtConfig: JwtConfig;
  private readonly appConfig: AppConfig;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly verificationTokensRepository: VerificationTokensRepository,
    private readonly mailService: MailService,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt') as JwtConfig;
    this.appConfig = this.configService.get<AppConfig>('app') as AppConfig;
  }

  async register(
    email: string,
    password: string,
    fullName: string,
  ): Promise<UserEntity> {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email đã được sử dụng',
      });
    }
    const passwordHash = await argon2.hash(password);
    return this.usersService.createUser({
      email: normalizedEmail,
      passwordHash,
      fullName,
      role: UserRole.CUSTOMER,
    });
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      await this.simulatePasswordVerification();
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Tài khoản không thể đăng nhập',
      });
    }

    return user;
  }

  async login(user: UserEntity): Promise<LoginResult> {
    const accessToken = this.signAccessToken(user);
    const { rawToken, expiresAt } = await this.issueRefreshToken(user.id);
    return {
      accessToken,
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt,
      user,
    };
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const {
      rawToken,
      tokenHash: newTokenHash,
      expiresAt,
    } = this.generateRefreshToken();

    const outcome = await this.refreshTokensRepository.rotate(tokenHash, {
      tokenHash: newTokenHash,
      expiresAt,
    });

    if (outcome.kind !== 'success') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Phiên đăng nhập không hợp lệ',
      });
    }

    const accessToken = this.signAccessToken(outcome.user);

    return {
      accessToken,
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt,
      user: outcome.user,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing =
      await this.refreshTokensRepository.findByTokenHash(tokenHash);
    if (existing && !existing.revokedAt) {
      await this.refreshTokensRepository.revoke(existing.id);
    }
  }

  private signAccessToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: parseDurationToSeconds(this.jwtConfig.accessExpiresIn),
    });
  }

  private generateRefreshToken(): {
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashRefreshToken(rawToken);
    const expiresAt = new Date(
      Date.now() +
        parseDurationToSeconds(this.jwtConfig.refreshExpiresIn) * 1000,
    );
    return { rawToken, tokenHash, expiresAt };
  }

  private async issueRefreshToken(
    userId: string,
  ): Promise<RefreshTokenIssueResult> {
    const { rawToken, tokenHash, expiresAt } = this.generateRefreshToken();

    const entity = this.refreshTokensRepository.create({
      userId,
      tokenHash,
      expiresAt,
    });
    await this.refreshTokensRepository.save(entity);

    return { rawToken, expiresAt };
  }

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async simulatePasswordVerification(): Promise<void> {
    await argon2.hash(randomBytes(16).toString('hex'));
  }

  /**
   * Issues the verification email; best-effort only. SMTP failures are
   * logged (metadata only, never the token/URL) and swallowed so that
   * registration never fails because mail delivery failed.
   */
  async requestEmailVerification(user: UserEntity): Promise<void> {
    const rawToken = await this.issueVerificationToken(
      user.id,
      VerificationTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TOKEN_TTL_MS,
    );
    const verificationUrl = `${this.appConfig.frontendUrl}/verify-email?token=${rawToken}`;
    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.fullName,
        verificationUrl,
        EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
        'vi',
      );
    } catch {
      this.logger.warn('Failed to send verification email');
    }
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const outcome = await this.verificationTokensRepository.consume(
      this.hashVerificationToken(rawToken),
      VerificationTokenPurpose.EMAIL_VERIFICATION,
    );
    if (outcome.kind !== 'success') {
      throw new UnauthorizedException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Đường dẫn xác minh không hợp lệ hoặc đã hết hạn',
      });
    }
    await this.usersService.markEmailVerified(outcome.user.id);
  }

  /**
   * Silent by design: never reveals whether the email belongs to an
   * account. Always resolves without error.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      await this.simulatePasswordVerification();
      return;
    }
    const rawToken = await this.issueVerificationToken(
      user.id,
      VerificationTokenPurpose.PASSWORD_RESET,
      PASSWORD_RESET_TOKEN_TTL_MS,
    );
    const resetUrl = `${this.appConfig.frontendUrl}/reset-password?token=${rawToken}`;
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.fullName,
        resetUrl,
        PASSWORD_RESET_TOKEN_TTL_MINUTES,
        'vi',
      );
    } catch {
      this.logger.warn('Failed to send password reset email');
    }
  }

  /**
   * Same silent behavior as requestPasswordReset: already-verified or
   * unknown emails resolve without sending anything and without error.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user || user.emailVerifiedAt) {
      await this.simulatePasswordVerification();
      return;
    }
    await this.requestEmailVerification(user);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const outcome = await this.verificationTokensRepository.consume(
      this.hashVerificationToken(rawToken),
      VerificationTokenPurpose.PASSWORD_RESET,
    );
    if (outcome.kind !== 'success') {
      throw new UnauthorizedException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.updatePasswordHash(outcome.user.id, passwordHash);
    // Resetting the password revokes every existing session — the old
    // password (and any refresh token issued under it) must stop working.
    await this.refreshTokensRepository.revokeAllForUser(outcome.user.id);
  }

  private async issueVerificationToken(
    userId: string,
    purpose: VerificationTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    const entity = this.verificationTokensRepository.create({
      userId,
      purpose,
      tokenHash,
      expiresAt,
    });
    await this.verificationTokensRepository.save(entity);

    return rawToken;
  }

  private hashVerificationToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
