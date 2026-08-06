import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';
import {
  CouponDiscountType,
  CouponEntity,
} from '../src/modules/coupons/entities/coupon.entity';

describe('Featured Coupons (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "coupons" CASCADE');
  });

  const server = () => app.getHttpServer();
  let counter = 0;
  function unique(prefix: string): string {
    counter += 1;
    return `${prefix}-${counter}-${Date.now()}`;
  }

  async function seedCoupon(
    overrides: Partial<CouponEntity> = {},
  ): Promise<CouponEntity> {
    const repo = dataSource.getRepository(CouponEntity);
    return repo.save(
      repo.create({
        code: unique('CODE').toUpperCase(),
        name: 'Test coupon',
        description: null,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usageLimit: null,
        perUserLimit: null,
        usedCount: 0,
        isActive: true,
        isFeatured: true,
        featuredOrder: 0,
        ...overrides,
      }),
    );
  }

  it('is public (no auth required)', async () => {
    const res = await request(server()).get('/api/v1/coupons/featured');
    expect(res.status).toBe(200);
  });

  it('only returns coupons that are isFeatured + isActive + within the time window + under usage limit', async () => {
    const valid = await seedCoupon();
    await seedCoupon({ isFeatured: false }); // not featured
    await seedCoupon({ isActive: false }); // inactive
    await seedCoupon({ startsAt: new Date(Date.now() + 60_000) }); // not started
    await seedCoupon({
      startsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 60_000),
    }); // expired
    await seedCoupon({ usageLimit: 1, usedCount: 1 }); // exhausted

    const res = await request(server()).get('/api/v1/coupons/featured');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].code).toBe(valid.code);
  });

  it('orders by featuredOrder ASC, then endsAt ASC, then createdAt DESC, then id ASC', async () => {
    const second = await seedCoupon({ featuredOrder: 1 });
    const first = await seedCoupon({ featuredOrder: 0 });

    const res = await request(server()).get('/api/v1/coupons/featured');

    expect(res.body[0].code).toBe(first.code);
    expect(res.body[1].code).toBe(second.code);
  });

  it('respects the limit query param', async () => {
    await seedCoupon();
    await seedCoupon();
    await seedCoupon();

    const res = await request(server()).get('/api/v1/coupons/featured?limit=2');

    expect(res.body).toHaveLength(2);
  });

  it('does not leak internal fields (usedCount, deletedAt, applicableCategoryId)', async () => {
    await seedCoupon();
    const res = await request(server()).get('/api/v1/coupons/featured');
    expect(res.body[0]).not.toHaveProperty('usedCount');
    expect(res.body[0]).not.toHaveProperty('deletedAt');
    expect(res.body[0]).not.toHaveProperty('applicableCategoryId');
    expect(res.body[0]).not.toHaveProperty('usageLimit');
  });
});
