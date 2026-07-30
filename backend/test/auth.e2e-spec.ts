import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { RedisService } from '../src/infrastructure/cache/redis.service';

describe('Auth (e2e)', () => {
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
    await dataSource.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    await redisService.getClient().flushdb();
  });

  const server = () => app.getHttpServer();

  describe('GET /api/v1/health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(server()).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user successfully', async () => {
      const res = await request(server()).post('/api/v1/auth/register').send({
        email: 'user1@example.com',
        password: 'StrongPass123!',
        fullName: 'User One',
      });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('user1@example.com');
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.password).toBeUndefined();
    });

    it('rejects duplicate email registration', async () => {
      await request(server()).post('/api/v1/auth/register').send({
        email: 'dup@example.com',
        password: 'StrongPass123!',
        fullName: 'Dup User',
      });
      const res = await request(server()).post('/api/v1/auth/register').send({
        email: 'dup@example.com',
        password: 'AnotherPass123!',
        fullName: 'Dup User 2',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('rejects requests with non-whitelisted fields', async () => {
      const res = await request(server()).post('/api/v1/auth/register').send({
        email: 'extra@example.com',
        password: 'StrongPass123!',
        fullName: 'Extra User',
        role: 'ADMIN',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(server()).post('/api/v1/auth/register').send({
        email: 'login@example.com',
        password: 'StrongPass123!',
        fullName: 'Login User',
      });
    });

    it('logs in with correct credentials and sets refresh cookie', async () => {
      const res = await request(server()).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'StrongPass123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers['set-cookie']?.[0]).toContain('refresh_token=');
    });

    it('rejects incorrect password', async () => {
      const res = await request(server()).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not allow a BLOCKED user to log in', async () => {
      await dataSource
        .getRepository(UserEntity)
        .update({ email: 'login@example.com' }, { status: UserStatus.BLOCKED });

      const res = await request(server()).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'StrongPass123!',
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVE');
    });
  });

  describe('refresh token rotation', () => {
    async function registerAndLogin(email: string) {
      await request(server()).post('/api/v1/auth/register').send({
        email,
        password: 'StrongPass123!',
        fullName: 'Refresh User',
      });
      const res = await request(server()).post('/api/v1/auth/login').send({
        email,
        password: 'StrongPass123!',
      });
      const cookie = res.headers['set-cookie'][0];
      return cookie;
    }

    it('rotates refresh token and old token cannot be reused', async () => {
      const cookie = await registerAndLogin('rotate@example.com');

      const refreshRes = await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      const newCookie = refreshRes.headers['set-cookie'][0];
      expect(newCookie).not.toEqual(cookie);

      const reuseRes = await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects refresh without a token', async () => {
      const res = await request(server()).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('logout revokes the refresh token', async () => {
      const cookie = await registerAndLogin('logout@example.com');

      const logoutRes = await request(server())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);
      expect(logoutRes.status).toBe(204);

      const refreshRes = await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a token', async () => {
      const res = await request(server()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid token', async () => {
      await request(server()).post('/api/v1/auth/register').send({
        email: 'me@example.com',
        password: 'StrongPass123!',
        fullName: 'Me User',
      });
      const loginRes = await request(server()).post('/api/v1/auth/login').send({
        email: 'me@example.com',
        password: 'StrongPass123!',
      });
      const token = loginRes.body.accessToken;

      const meRes = await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('me@example.com');
    });
  });
});
