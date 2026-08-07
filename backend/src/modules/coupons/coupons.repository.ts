import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CouponEntity } from './entities/coupon.entity';

@Injectable()
export class CouponsRepository {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly repository: Repository<CouponEntity>,
  ) {}

  /**
   * Matches the case-insensitive `UQ_coupons_code_upper` functional index —
   * the caller (CouponsService) already normalizes to uppercase, but this
   * query is itself case-insensitive so it is correct regardless of how a
   * given row's `code` column happens to be cased in storage.
   */
  findByCodeUpper(code: string): Promise<CouponEntity | null> {
    return this.repository
      .createQueryBuilder('coupon')
      .where('upper(coupon.code) = upper(:code)', { code })
      .getOne();
  }

  /**
   * Featured, currently-valid coupons for public marketing display — one
   * query, no N+1. "Currently valid" here means active + within its time
   * window + not yet at its usage limit; appearing here is not a guarantee
   * a given Cart can redeem it (minimum subtotal is Cart-specific and
   * re-checked at preview/apply time).
   */
  async findFeatured(limit: number, now: Date): Promise<CouponEntity[]> {
    return this.repository
      .createQueryBuilder('coupon')
      .where('coupon.is_featured = true')
      .andWhere('coupon.is_active = true')
      .andWhere('coupon.starts_at <= :now', { now })
      .andWhere('coupon.ends_at > :now', { now })
      .andWhere(
        '(coupon.usage_limit IS NULL OR coupon.used_count < coupon.usage_limit)',
      )
      .orderBy('coupon.featured_order', 'ASC')
      .addOrderBy('coupon.ends_at', 'ASC')
      .addOrderBy('coupon.created_at', 'DESC')
      .addOrderBy('coupon.id', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Pessimistic-write lock, for use inside a transaction (redemption path). */
  lockForUpdate(
    couponId: string,
    manager: EntityManager,
  ): Promise<CouponEntity | null> {
    return manager.getRepository(CouponEntity).findOne({
      where: { id: couponId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async incrementUsedCount(
    couponId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(CouponEntity)
      .increment({ id: couponId }, 'usedCount', 1);
  }

  /**
   * Inverse of `incrementUsedCount`, for the cancellation/rollback path. The
   * caller (CouponsService.rollbackRedemption) only invokes this after it has
   * confirmed a redemption row actually existed and was deleted in the same
   * transaction, so this never drives usedCount below the redemptions that
   * remain (guarded further by CHK_coupons_used_count_non_negative).
   */
  async decrementUsedCount(
    couponId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(CouponEntity)
      .decrement({ id: couponId }, 'usedCount', 1);
  }
}
