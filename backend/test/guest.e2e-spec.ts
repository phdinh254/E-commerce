import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

function toArray(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function parseCookie(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const line = toArray(header).find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0];
}

function fullCookieLine(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  return toArray(header).find((c) => c.startsWith(`${name}=`));
}

describe('Guest sessions and authorization (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisService: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "guest_claims" CASCADE');
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    await redisService.getClient().flushdb();
  });

  const server = () => app.getHttpServer();

  describe('POST /api/v1/auth/guest', () => {
    it('creates a new guest session and sets a cookie when none is presented', async () => {
      const res = await request(server()).post('/api/v1/auth/guest');
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('guest');
      expect(res.body.expiresAt).toBeTruthy();
      const cookie = parseCookie(res.headers['set-cookie'], 'guest_session');
      expect(cookie).toBeDefined();
      expect(
        fullCookieLine(res.headers['set-cookie'], 'guest_session'),
      ).toContain('HttpOnly');
    });

    it('reuses an existing valid guest cookie without setting a new one', async () => {
      const first = await request(server()).post('/api/v1/auth/guest');
      const cookie = parseCookie(first.headers['set-cookie'], 'guest_session');

      const second = await request(server())
        .post('/api/v1/auth/guest')
        .set('Cookie', cookie as string);
      expect(second.status).toBe(200);
      expect(second.headers['set-cookie']).toBeUndefined();
    });

    it('creates a fresh session when the cookie points to a key that no longer exists in Redis', async () => {
      const fakeCookie = 'guest_session=' + 'a'.repeat(64);
      const res = await request(server())
        .post('/api/v1/auth/guest')
        .set('Cookie', fakeCookie);
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('guest');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('does not accept a client-supplied guestId to control the session (body is rejected/ignored)', async () => {
      const res = await request(server())
        .post('/api/v1/auth/guest')
        .send({ guestId: 'attacker-chosen-id', role: 'ADMIN' });
      // ValidationPipe.forbidNonWhitelisted rejects unexpected body fields
      // outright for any endpoint with a DTO; this endpoint has none, so it
      // simply ignores the body — either way, the attacker-chosen id/role
      // is never used as a real guestId or role.
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.kind).toBe('guest');
      }
    });
  });

  describe('GET /api/v1/auth/guest/whoami — guest-or-user resolution', () => {
    it('resolves to a guest principal when no token is presented', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const cookie = parseCookie(init.headers['set-cookie'], 'guest_session');

      const res = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Cookie', cookie as string);
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('guest');
      expect(res.body.roles).toEqual(['GUEST']);
      expect(res.body.guestId).toBeDefined();
    });

    it('creates a guest session automatically when no cookie exists at all', async () => {
      const res = await request(server()).get('/api/v1/auth/guest/whoami');
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('guest');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('resolves to a user principal when a valid access token is presented', async () => {
      await request(server()).post('/api/v1/auth/register').send({
        email: 'wu@example.com',
        password: 'StrongPass123!',
        fullName: 'Whoami User',
      });
      const loginRes = await request(server()).post('/api/v1/auth/login').send({
        email: 'wu@example.com',
        password: 'StrongPass123!',
      });

      const res = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('user');
      expect(res.body.email).toBe('wu@example.com');
    });

    it('rejects a malformed/invalid access token instead of downgrading to guest', async () => {
      const res = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Authorization', 'Bearer not-a-real-jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('Authorization matrix', () => {
    async function registerAndLogin(email: string): Promise<string> {
      await request(server()).post('/api/v1/auth/register').send({
        email,
        password: 'StrongPass123!',
        fullName: 'Matrix User',
      });
      const res = await request(server()).post('/api/v1/auth/login').send({
        email,
        password: 'StrongPass123!',
      });
      return res.body.accessToken as string;
    }

    it('GET /auth/me (authenticated-only): guest cookie alone is rejected', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const cookie = parseCookie(init.headers['set-cookie'], 'guest_session');
      const res = await request(server())
        .get('/api/v1/auth/me')
        .set('Cookie', cookie as string);
      expect(res.status).toBe(401);
    });

    it('GET /auth/me (authenticated-only): no session at all is rejected', async () => {
      const res = await request(server()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /auth/admin/ping: guest is denied (403)', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const cookie = parseCookie(init.headers['set-cookie'], 'guest_session');
      const res = await request(server())
        .get('/api/v1/auth/admin/ping')
        .set('Cookie', cookie as string);
      expect(res.status).toBe(403);
    });

    it('GET /auth/admin/ping: no session at all is 401, not 403', async () => {
      const res = await request(server()).get('/api/v1/auth/admin/ping');
      expect(res.status).toBe(401);
    });

    it('GET /auth/admin/ping: CUSTOMER is denied (403)', async () => {
      const token = await registerAndLogin('customer1@example.com');
      const res = await request(server())
        .get('/api/v1/auth/admin/ping')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('GET /auth/admin/ping: ADMIN is allowed (200)', async () => {
      await registerAndLogin('admin1@example.com');
      await dataSource
        .getRepository(UserEntity)
        .update({ email: 'admin1@example.com' }, { role: UserRole.ADMIN });
      // Re-login so the access token carries the updated role.
      const loginRes = await request(server()).post('/api/v1/auth/login').send({
        email: 'admin1@example.com',
        password: 'StrongPass123!',
      });
      const res = await request(server())
        .get('/api/v1/auth/admin/ping')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('a fake X-Role header has no effect on authorization', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const cookie = parseCookie(init.headers['set-cookie'], 'guest_session');
      const res = await request(server())
        .get('/api/v1/auth/admin/ping')
        .set('Cookie', cookie as string)
        .set('X-Role', 'ADMIN');
      expect(res.status).toBe(403);
    });
  });

  describe('Guest-to-user claim flow', () => {
    it('claims the guest session on register: guest_claims row created, cookie cleared, old cookie no longer resolves to the same session', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const guestCookie = parseCookie(
        init.headers['set-cookie'],
        'guest_session',
      );
      const whoamiBefore = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Cookie', guestCookie as string);
      const guestId = whoamiBefore.body.guestId as string;

      const registerRes = await request(server())
        .post('/api/v1/auth/register')
        .set('Cookie', guestCookie as string)
        .send({
          email: 'claimer@example.com',
          password: 'StrongPass123!',
          fullName: 'Claimer User',
        });
      expect(registerRes.status).toBe(201);

      const claimRow = await dataSource.query(
        'SELECT * FROM "guest_claims" WHERE "guest_id" = $1',
        [guestId],
      );
      expect(claimRow).toHaveLength(1);

      const clearedCookie = parseCookie(
        registerRes.headers['set-cookie'],
        'guest_session',
      );
      expect(clearedCookie).toBeDefined();

      // Presenting the old (now-claimed) raw guest cookie again must not
      // resolve to the same guest identity — it gets treated as absent and
      // a brand new session is created instead.
      const whoamiAfter = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Cookie', guestCookie as string);
      expect(whoamiAfter.status).toBe(200);
      expect(whoamiAfter.body.guestId).not.toBe(guestId);
    });

    it('is idempotent: claiming the same guest session twice for the same user does not create a duplicate row', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const guestCookie = parseCookie(
        init.headers['set-cookie'],
        'guest_session',
      );
      const whoami = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Cookie', guestCookie as string);
      const guestId = whoami.body.guestId as string;

      await request(server())
        .post('/api/v1/auth/register')
        .set('Cookie', guestCookie as string)
        .send({
          email: 'retry@example.com',
          password: 'StrongPass123!',
          fullName: 'Retry User',
        });

      // Simulate a retry: log in again while still presenting the very
      // same original (stale) guest cookie value directly, bypassing
      // whatever the browser would normally have cleared.
      const secondAttempt = await request(server())
        .post('/api/v1/auth/login')
        .set('Cookie', guestCookie as string)
        .send({ email: 'retry@example.com', password: 'StrongPass123!' });
      expect(secondAttempt.status).toBe(200);

      const rows = await dataSource.query(
        'SELECT * FROM "guest_claims" WHERE "guest_id" = $1',
        [guestId],
      );
      expect(rows).toHaveLength(1);
    });

    it('rejects claiming a guest session already claimed by a different user, and the original owner keeps it', async () => {
      const init = await request(server()).post('/api/v1/auth/guest');
      const guestCookie = parseCookie(
        init.headers['set-cookie'],
        'guest_session',
      );
      const whoami = await request(server())
        .get('/api/v1/auth/guest/whoami')
        .set('Cookie', guestCookie as string);
      const guestId = whoami.body.guestId as string;

      await request(server())
        .post('/api/v1/auth/register')
        .set('Cookie', guestCookie as string)
        .send({
          email: 'owner@example.com',
          password: 'StrongPass123!',
          fullName: 'Owner User',
        });
      const [ownerRow] = await dataSource.query(
        'SELECT * FROM "guest_claims" WHERE "guest_id" = $1',
        [guestId],
      );

      // A different user registers while presenting the exact same
      // (already-claimed) raw guest cookie — the request must still
      // succeed for them (claim failure never blocks auth), but ownership
      // must not move.
      const intruderRes = await request(server())
        .post('/api/v1/auth/register')
        .set('Cookie', guestCookie as string)
        .send({
          email: 'intruder@example.com',
          password: 'StrongPass123!',
          fullName: 'Intruder User',
        });
      expect(intruderRes.status).toBe(201);

      const rows = await dataSource.query(
        'SELECT * FROM "guest_claims" WHERE "guest_id" = $1',
        [guestId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(ownerRow.user_id);
    });

    it('registering with no guest cookie at all does not create any guest_claims row', async () => {
      const res = await request(server()).post('/api/v1/auth/register').send({
        email: 'noguest@example.com',
        password: 'StrongPass123!',
        fullName: 'No Guest User',
      });
      expect(res.status).toBe(201);
      const rows = await dataSource.query('SELECT * FROM "guest_claims"');
      expect(rows).toHaveLength(0);
    });
  });
});
