import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CouponRedemptionEntity } from './entities/coupon-redemption.entity';

export type RedemptionInsertOutcome =
  | { kind: 'inserted'; redemption: CouponRedemptionEntity }
  | { kind: 'already-redeemed'; redemption: CouponRedemptionEntity };

@Injectable()
export class CouponRedemptionsRepository {
  /**
   * Atomic idempotency check-and-insert, same shape as
   * GuestClaimsRepository.insertIfAbsent: relies on
   * `UQ_coupon_redemptions_order_id`, not application-level locking. A
   * retried or concurrent confirmation of the same order has exactly one
   * INSERT succeed; every other caller reads back the winner's row and
   * must NOT increment usedCount again.
   */
  async insertIfAbsent(
    params: {
      couponId: string;
      orderId: string;
      userId: string;
      discountAmount: number;
      couponCodeSnapshot: string;
    },
    manager: EntityManager,
  ): Promise<RedemptionInsertOutcome> {
    const repo = manager.getRepository(CouponRedemptionEntity);

    const result = await repo
      .createQueryBuilder()
      .insert()
      .into(CouponRedemptionEntity)
      .values(params)
      .orIgnore()
      .returning('*')
      .execute();

    const raw = result.raw as CouponRedemptionEntity[];
    if (raw.length > 0) {
      return { kind: 'inserted', redemption: raw[0] };
    }

    const existing = await repo.findOneOrFail({
      where: { orderId: params.orderId },
    });
    return { kind: 'already-redeemed', redemption: existing };
  }

  /**
   * Read the (at most one — UQ_coupon_redemptions_order_id) redemption row for
   * an order. The rollback path checks this BEFORE decrementing usedCount so a
   * retried cancellation of an already-rolled-back order (no row) is a safe
   * no-op instead of a double-decrement.
   */
  findByOrderId(
    orderId: string,
    manager: EntityManager,
  ): Promise<CouponRedemptionEntity | null> {
    return manager
      .getRepository(CouponRedemptionEntity)
      .findOne({ where: { orderId } });
  }

  /**
   * Delete the redemption row for an order. Returns the number of rows removed
   * so the caller decrements usedCount only for a redemption it actually
   * deleted, never on assumption.
   */
  async deleteByOrderId(
    orderId: string,
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .getRepository(CouponRedemptionEntity)
      .delete({ orderId });
    return result.affected ?? 0;
  }
}
