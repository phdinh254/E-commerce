import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { CouponEntity } from '../coupons/entities/coupon.entity';

/**
 * Persists coupon association changes on the cart's Order row. Every
 * method requires a transaction `manager` — callers (CartCouponService,
 * CartPricingService) always run these inside CartRepository.runInTransaction
 * or an equivalent lock so a mutation is never partially applied.
 */
@Injectable()
export class CartCouponRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  /** Locks the order row for update — serializes concurrent apply/remove/
   * mutation-revalidation calls for the same cart. */
  lockOrder(
    orderId: string,
    manager: EntityManager,
  ): Promise<OrderEntity | null> {
    return manager.getRepository(OrderEntity).findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Plain (unlocked) read — cart-level revalidation is best-effort and
   * self-healing on the next call; the strict pessimistic lock lives in
   * CouponsRepository.lockForUpdate for the actual redemption/confirmation
   * path, where a lost race would double-count usage. */
  findCoupon(
    couponId: string,
    manager: EntityManager,
  ): Promise<CouponEntity | null> {
    return manager
      .getRepository(CouponEntity)
      .findOne({ where: { id: couponId } });
  }

  async setCoupon(
    orderId: string,
    params: {
      couponId: string;
      couponCodeSnapshot: string;
      couponNameSnapshot: string | null;
      couponDiscountTypeSnapshot: CouponEntity['discountType'];
      couponDiscountValueSnapshot: number;
      discountAmount: number;
    },
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(OrderEntity).update({ id: orderId }, params);
  }

  async clearCoupon(orderId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(OrderEntity).update(
      { id: orderId },
      {
        couponId: null,
        couponCodeSnapshot: null,
        couponNameSnapshot: null,
        couponDiscountTypeSnapshot: null,
        couponDiscountValueSnapshot: null,
        discountAmount: 0,
      },
    );
  }

  async updateDiscountAmount(
    orderId: string,
    discountAmount: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(OrderEntity)
      .update({ id: orderId }, { discountAmount });
  }
}
