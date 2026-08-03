import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestClaimEntity } from './entities/guest-claim.entity';
import { GuestSessionsRepository } from './guest-sessions.repository';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestClaimsRepository } from './guest-claims.repository';
import { GuestClaimService } from './guest-claim.service';
import { GuestController } from './guest.controller';
import { GuestCookieInterceptor } from './guest-cookie.interceptor';
import { GUEST_CLAIM_HANDLERS } from './guest-claim-handler.interface';

@Module({
  imports: [TypeOrmModule.forFeature([GuestClaimEntity])],
  controllers: [GuestController],
  providers: [
    GuestSessionsRepository,
    GuestSessionsService,
    GuestClaimsRepository,
    GuestClaimService,
    // No guest-owned domain data exists yet (no Cart module). A future
    // chapter that adds one re-provides this same token — in a module
    // imported after this one — with its handler(s) included instead of
    // an empty array.
    { provide: GUEST_CLAIM_HANDLERS, useValue: [] },
    { provide: APP_INTERCEPTOR, useClass: GuestCookieInterceptor },
  ],
  exports: [GuestSessionsService, GuestClaimService],
})
export class GuestModule {}
