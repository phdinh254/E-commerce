import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowGuest } from './decorators/allow-guest.decorator';
import { AdminOnly } from './decorators/admin-only.decorator';
import { CurrentPrincipal } from './decorators/current-principal.decorator';
import { GuestSessionsService } from './guest-sessions.service';
import type { RequestPrincipal } from './interfaces/request-principal.interface';

@ApiTags('guest')
@Controller({ path: 'auth' })
export class GuestController {
  constructor(private readonly guestSessionsService: GuestSessionsService) {}

  /**
   * Idempotent from the client's point of view: a request with an existing
   * valid guest cookie reuses that session (no new Redis key, no new
   * `Set-Cookie`) — the actual session creation/reuse decision is made by
   * `JwtAuthGuard` before this handler ever runs; this endpoint only
   * reports the outcome.
   */
  @AllowGuest()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize or reuse a guest session' })
  @ApiResponse({
    status: 200,
    description: 'Guest or authenticated session confirmed',
  })
  async initGuestSession(
    @CurrentPrincipal() principal: RequestPrincipal,
  ): Promise<{ kind: RequestPrincipal['kind']; expiresAt: string | null }> {
    if (principal.kind === 'user') {
      return { kind: 'user', expiresAt: null };
    }
    const ttlSeconds = await this.guestSessionsService.getTtlSeconds(
      principal.guestId,
    );
    return {
      kind: 'guest',
      expiresAt:
        ttlSeconds !== null
          ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
          : null,
    };
  }

  /** Diagnostic endpoint proving guest-or-user resolution end-to-end. */
  @AllowGuest()
  @Get('guest/whoami')
  @ApiOperation({ summary: 'Report the resolved principal (guest or user)' })
  whoami(@CurrentPrincipal() principal: RequestPrincipal): RequestPrincipal {
    return principal;
  }

  /** Diagnostic endpoint proving role-based access end-to-end. */
  @AdminOnly()
  @Get('admin/ping')
  @ApiOperation({ summary: 'Prove ADMIN-only access works' })
  adminPing(): { ok: true } {
    return { ok: true };
  }
}
