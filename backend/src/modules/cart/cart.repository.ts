import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusHistoryEntity } from './entities/order-status-history.entity';
import { OrderStatus } from './enums/order-status.enum';

export type AddItemOutcome =
  | { kind: 'incremented'; item: OrderItemEntity }
  | { kind: 'created'; item: OrderItemEntity };

export type UpdateItemOutcome =
  { kind: 'not_found' } | { kind: 'ok'; item: OrderItemEntity };

@Injectable()
export class CartRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepository: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusHistoryEntity)
    private readonly historyRepository: Repository<OrderStatusHistoryEntity>,
  ) {}

  /** Read-only — GET /cart must never create a row just to serve a read. */
  findActiveCartWithItems(userId: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { userId, status: OrderStatus.CART },
      relations: {
        items: { product: true, variant: true },
      },
      order: { items: { createdAt: 'ASC', id: 'ASC' } },
    });
  }

  /**
   * Atomic idempotent get-or-create, mirroring
   * GuestClaimsRepository.insertIfAbsent: relies on the partial unique
   * index UQ_orders_user_id_active_cart as the actual concurrency guard,
   * not an application-level SELECT-then-INSERT race. Two concurrent
   * callers racing to create the first cart for a user have exactly one
   * INSERT succeed; the loser reads back the row the winner just wrote.
   */
  async getOrCreateActiveCart(
    userId: string,
    manager?: EntityManager,
  ): Promise<OrderEntity> {
    const orderRepo = manager
      ? manager.getRepository(OrderEntity)
      : this.orderRepository;
    const historyRepo = manager
      ? manager.getRepository(OrderStatusHistoryEntity)
      : this.historyRepository;

    const result = await orderRepo
      .createQueryBuilder()
      .insert()
      .into(OrderEntity)
      .values({ userId, status: OrderStatus.CART })
      .orIgnore()
      .returning('*')
      .execute();

    const raw = result.raw as OrderEntity[];
    if (raw.length > 0) {
      const created = raw[0];
      await historyRepo.insert(
        historyRepo.create({
          orderId: created.id,
          fromStatus: null,
          toStatus: OrderStatus.CART,
        }),
      );
      created.items = [];
      return created;
    }

    const existing = await orderRepo.findOneOrFail({
      where: { userId, status: OrderStatus.CART },
      relations: { items: { product: true, variant: true } },
    });
    return existing;
  }

  /**
   * Checkout entry point — locks the CART order row (pessimistic write, same
   * row Cart mutations already lock in addOrIncrementItem) so a concurrent
   * add-item/checkout race serializes instead of checking out a snapshot
   * that a racing mutation is about to change. Returns null when the user
   * has no active cart (never checked out) — distinct from "cart exists but
   * empty", which the caller must check separately via `items.length`.
   *
   * Locks the order row WITHOUT joined relations first — Postgres rejects
   * `FOR UPDATE` on the nullable side of a LEFT JOIN, which is exactly what
   * `relations` would generate for a one-to-many `items` fetch in the same
   * query. Items are then fetched unlocked in a second query, same
   * lock-then-read shape as `addOrIncrementItem`.
   */
  async lockActiveCartWithItemsForUser(
    userId: string,
    manager: EntityManager,
  ): Promise<OrderEntity | null> {
    const order = await manager.getRepository(OrderEntity).findOne({
      where: { userId, status: OrderStatus.CART },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) return null;

    order.items = await manager.getRepository(OrderItemEntity).find({
      where: { orderId: order.id },
      relations: { product: true, variant: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return order;
  }

  /** Runs `fn` in a single transaction — callers that need to combine an
   * idempotency check-and-insert with a cart mutation atomically (so a
   * mid-transaction failure never leaves an orphaned idempotency row) get
   * one shared `manager` to pass into both. */
  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.orderRepository.manager.transaction(fn);
  }

  /**
   * Locks the parent order row (pessimistic write) to serialize concurrent
   * add-item calls for the same cart — two requests racing to add the same
   * (product, variant) line settle into a single summed quantity instead of
   * two rows or a lost update. Mirrors RefreshTokensRepository.rotate()'s
   * lock-then-mutate shape. Must run inside a transaction — pass the
   * `manager` from runInTransaction (or an outer transaction that also
   * covers the idempotency-key insert).
   */
  async addOrIncrementItem(
    manager: EntityManager,
    params: {
      orderId: string;
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPriceAmount: number;
    },
  ): Promise<AddItemOutcome> {
    const orderRepo = manager.getRepository(OrderEntity);
    const itemRepo = manager.getRepository(OrderItemEntity);

    await orderRepo.findOne({
      where: { id: params.orderId },
      lock: { mode: 'pessimistic_write' },
    });

    const existing = await itemRepo.findOne({
      where: {
        orderId: params.orderId,
        productId: params.productId,
        variantId: params.variantId === null ? IsNull() : params.variantId,
      },
    });

    if (existing) {
      existing.quantity += params.quantity;
      existing.unitPriceAmount = params.unitPriceAmount;
      const saved = await itemRepo.save(existing);
      return { kind: 'incremented', item: saved };
    }

    const created = await itemRepo.save(
      itemRepo.create({
        orderId: params.orderId,
        productId: params.productId,
        variantId: params.variantId,
        quantity: params.quantity,
        unitPriceAmount: params.unitPriceAmount,
      }),
    );
    return { kind: 'created', item: created };
  }

  /** Ownership-scoped single-item lookup with product/variant joined, used
   * by the service to decide whether an availability-gated update is
   * allowed before actually mutating. */
  findItemForUser(
    userId: string,
    itemId: string,
  ): Promise<OrderItemEntity | null> {
    return this.itemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .where('item.id = :itemId', { itemId })
      .andWhere('order.user_id = :userId', { userId })
      .andWhere('order.status = :status', { status: OrderStatus.CART })
      .getOne();
  }

  /**
   * Ownership is enforced in the query itself (join on order.user_id), not
   * checked after the fact — an itemId belonging to another user simply
   * does not match, indistinguishable from a non-existent id.
   */
  async updateItemQuantityForUser(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<UpdateItemOutcome> {
    return this.itemRepository.manager.transaction(async (manager) => {
      const item = await manager
        .createQueryBuilder(OrderItemEntity, 'item')
        .innerJoin('item.order', 'order')
        .where('item.id = :itemId', { itemId })
        .andWhere('order.user_id = :userId', { userId })
        .andWhere('order.status = :status', { status: OrderStatus.CART })
        .setLock('pessimistic_write')
        .getOne();

      if (!item) {
        return { kind: 'not_found' };
      }

      item.quantity = quantity;
      const saved = await manager.getRepository(OrderItemEntity).save(item);
      return { kind: 'ok', item: saved };
    });
  }

  /**
   * Same ownership-in-query approach as update. Deletes affect 0 rows when
   * the itemId belongs to another user or does not exist — both cases are
   * intentionally indistinguishable, and both are reported as a successful,
   * idempotent no-op by the caller (see CartService), never leaking whether
   * the id exists at all.
   */
  async deleteItemForUser(userId: string, itemId: string): Promise<void> {
    await this.itemRepository
      .createQueryBuilder()
      .delete()
      .from(OrderItemEntity)
      .where(
        `id = :itemId AND order_id IN (
          SELECT id FROM orders WHERE user_id = :userId AND status = :status
        )`,
        { itemId, userId, status: OrderStatus.CART },
      )
      .execute();
  }
}
