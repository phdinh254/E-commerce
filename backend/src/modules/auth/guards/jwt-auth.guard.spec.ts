import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GuestSessionsService } from '../../guest/guest-sessions.service';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ALLOW_GUEST_KEY } from '../../guest/decorators/allow-guest.decorator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

function buildContext(cookies: Record<string, string> = {}) {
  const request = { cookies } as Request;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}) as unknown,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guestSessionsService: jest.Mocked<
    Pick<GuestSessionsService, 'getOrCreateSession' | 'findByRawToken'>
  >;
  let guard: JwtAuthGuard;
  let metadata: Record<string, unknown>;

  beforeEach(() => {
    metadata = {};
    reflector = {
      getAllAndOverride: jest.fn(
        (key: string) => metadata[key],
      ) as unknown as jest.Mocked<
        Pick<Reflector, 'getAllAndOverride'>
      >['getAllAndOverride'],
    };
    guestSessionsService = {
      getOrCreateSession: jest.fn(),
      findByRawToken: jest.fn(),
    };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      guestSessionsService as unknown as GuestSessionsService,
    );
    // super.canActivate() drives passport, which is heavy to stand up in a
    // unit test — the meaningful behavior for this guard lives in
    // handleRequest (called internally by passport) and in what
    // canActivate does with request.user afterward, both exercised
    // directly below. e2e coverage (test/guest.e2e-spec.ts) exercises the
    // real passport pipeline end to end.
    jest.spyOn(guard, 'canActivate');
  });

  describe('handleRequest', () => {
    it('returns the user when authentication succeeded', () => {
      const user = { id: 'u1', email: 'a@example.com', role: 'CUSTOMER' };
      expect(guard.handleRequest(null, user as never, null)).toBe(user);
    });

    it('tolerates a completely missing token (returns undefined, does not throw)', () => {
      expect(
        guard.handleRequest(null, false, new Error('No auth token')),
      ).toBeUndefined();
    });

    it('throws for a token that failed verification, even though err is null (passport reports it via info)', () => {
      expect(() =>
        guard.handleRequest(null, false, new Error('jwt malformed')),
      ).toThrow();
    });

    it('throws the original strategy error when one is set', () => {
      const err = new Error('boom');
      expect(() => guard.handleRequest(err, false, null)).toThrow(err);
    });

    it('throws UnauthorizedException (not a generic Error) when there is no err and no recognizable info', () => {
      expect(() => guard.handleRequest(null, false, null)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('canActivate — metadata-driven policy', () => {
    it('a bare route (no metadata) rejects a guest cookie outright — never even looks it up', async () => {
      metadata = {};
      const { context } = buildContext({ guest_session: 'raw-token' });
      // Simulate passport leaving request.user unset (no token presented).
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(guestSessionsService.findByRawToken).not.toHaveBeenCalled();
    });

    it('a @Roles-only route recognizes an existing guest cookie without creating a session', async () => {
      metadata = { [ROLES_KEY]: ['ADMIN'] };
      const { context, request } = buildContext({ guest_session: 'raw-token' });
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);
      guestSessionsService.findByRawToken.mockResolvedValue({
        guestId: 'hash-1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'ACTIVE',
        schemaVersion: 1,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(request.principal).toEqual({
        kind: 'guest',
        guestId: 'hash-1',
        roles: ['GUEST'],
      });
      expect(guestSessionsService.getOrCreateSession).not.toHaveBeenCalled();
    });

    it('a @Roles-only route rejects when the guest cookie does not resolve to an ACTIVE session', async () => {
      metadata = { [ROLES_KEY]: ['ADMIN'] };
      const { context } = buildContext({ guest_session: 'stale-token' });
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);
      guestSessionsService.findByRawToken.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('an @AllowGuest route creates a new guest session when none exists', async () => {
      metadata = { [ALLOW_GUEST_KEY]: true };
      const { context, request } = buildContext({});
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);
      guestSessionsService.getOrCreateSession.mockResolvedValue({
        session: {
          guestId: 'new-hash',
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          status: 'ACTIVE',
          schemaVersion: 1,
        },
        rawToken: 'new-raw-token',
        isNew: true,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(request.principal).toEqual({
        kind: 'guest',
        guestId: 'new-hash',
        roles: ['GUEST'],
      });
      expect(request.pendingGuestCookie?.value).toBe('new-raw-token');
      expect(typeof request.pendingGuestCookie?.maxAgeSeconds).toBe('number');
    });

    it('@Public bypasses everything and never touches guest resolution', async () => {
      metadata = { [IS_PUBLIC_KEY]: true };
      const { context } = buildContext({ guest_session: 'raw-token' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(guestSessionsService.findByRawToken).not.toHaveBeenCalled();
      expect(guestSessionsService.getOrCreateSession).not.toHaveBeenCalled();
    });
  });
});
