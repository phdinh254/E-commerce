import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CookieConfig } from '../../config/configuration';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleAuthCallbackGuard } from './guards/google-auth-callback.guard';
import { GoogleProfile } from './strategies/google.strategy';
import { GOOGLE_OAUTH_STATE_COOKIE } from './auth.constants';
import { AppConfig } from '../../config/configuration';
import { GuestClaimService } from '../guest/guest-claim.service';
import { GUEST_SESSION_COOKIE } from '../guest/guest.constants';

const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller({ path: 'auth' })
export class AuthController {
  private readonly cookieConfig: CookieConfig;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly guestClaimService: GuestClaimService,
  ) {
    this.cookieConfig = this.configService.get<CookieConfig>(
      'cookie',
    ) as CookieConfig;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const user = await this.authService.register(
      dto.email,
      dto.password,
      dto.fullName,
    );
    // Best-effort: verification email delivery never blocks registration.
    await this.authService.requestEmailVerification(user);
    await this.claimGuestSessionIfPresent(req, res, user.id);
    return this.toUserResponse(user);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const user = await this.authService.validateCredentials(
      dto.email,
      dto.password,
    );
    const result = await this.authService.login(user);
    this.setRefreshTokenCookie(res, result.refreshToken);
    await this.claimGuestSessionIfPresent(req, res, result.user.id);
    return {
      accessToken: result.accessToken,
      user: this.toUserResponse(result.user),
    };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const rawToken = this.extractRefreshToken(req);
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Thiếu refresh token',
      });
    }
    const result = await this.authService.refresh(rawToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: this.toUserResponse(result.user),
    };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth sign-in' })
  googleAuth(): void {
    // Handled entirely by GoogleAuthGuard, which redirects to Google.
  }

  @Public()
  @UseGuards(GoogleAuthCallbackGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user as GoogleProfile;
    const result = await this.authService.loginWithGoogle(profile);
    this.setRefreshTokenCookie(res, result.refreshToken);
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, { path: '/' });
    await this.claimGuestSessionIfPresent(req, res, result.user.id);
    const appConfig = this.configService.get<AppConfig>('app') as AppConfig;
    res.redirect(`${appConfig.frontendUrl}/auth/google/callback`);
  }

  /**
   * Reads the guest cookie directly off the request — never a guestId
   * supplied by the client — and hands it to `GuestClaimService`. A claim
   * failure (including "already claimed by another user") never blocks the
   * login/register response that triggered it; it is logged and the guest
   * cookie is cleared regardless, since this browser is now authenticated
   * and has no further use for it either way.
   */
  private async claimGuestSessionIfPresent(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const rawGuestToken = cookies?.[GUEST_SESSION_COOKIE];
    if (rawGuestToken) {
      try {
        await this.guestClaimService.claimFromRawToken(rawGuestToken, userId);
      } catch {
        // Already logged with a SECURITY warning inside GuestClaimService
        // for the "claimed by someone else" case; any other failure is
        // swallowed here so it can never break login/register.
      }
    }
    res.clearCookie(GUEST_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieConfig.secure,
      domain: this.cookieConfig.domain,
      path: '/',
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiResponse({ status: 204 })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = this.extractRefreshToken(req);
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    this.clearRefreshTokenCookie(res);
  }

  private extractRefreshToken(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_TOKEN_COOKIE];
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async me(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(authenticatedUser.id);
    if (!user) {
      throw new BadRequestException();
    }
    return this.toUserResponse(user);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify an account using an email verification token',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.authService.verifyEmail(dto.token);
    return { verified: true };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Resend the account verification email' })
  @ApiResponse({
    status: 202,
    description:
      'Always returned regardless of whether the email exists or is already verified',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'Nếu email tồn tại và chưa xác minh, hướng dẫn xác minh sẽ được gửi.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 202,
    description: 'Always returned regardless of whether the email exists',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'Nếu email đã được đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mật khẩu đã được cập nhật.' };
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieConfig.secure,
      domain: this.cookieConfig.domain,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieConfig.secure,
      domain: this.cookieConfig.domain,
      path: '/',
    });
  }

  private toUserResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }
}
