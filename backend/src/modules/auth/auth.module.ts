import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { VerificationTokenEntity } from './entities/verification-token.entity';
import { OAuthIdentityEntity } from './entities/oauth-identity.entity';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { VerificationTokensRepository } from './verification-tokens.repository';
import { OAuthIdentitiesRepository } from './oauth-identities.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleAuthCallbackGuard } from './guards/google-auth-callback.guard';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../../infrastructure/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      VerificationTokenEntity,
      OAuthIdentityEntity,
    ]),
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensRepository,
    VerificationTokensRepository,
    OAuthIdentitiesRepository,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    GoogleAuthCallbackGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
