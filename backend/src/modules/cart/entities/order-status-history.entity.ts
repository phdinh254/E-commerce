import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderActorType } from '../enums/order-actor-type.enum';

/**
 * Chapter 15 writes exactly one row per order (to=CART) when the cart is
 * first created. Per-quantity-change mutations are NOT status transitions
 * and do not write here — only Order.status changes do. Checkout (Chapter
 * 17/18) added the CART -> PENDING_PAYMENT -> PAID transitions.
 *
 * Chapter 19 (Order Management) replaces the bare `changedBy` column with
 * an `actorType`/`actorId` split: `actorType` records who category of actor
 * initiated the transition (customer, admin, or the system itself — e.g. a
 * payment webhook), and `actorId` is the corresponding user id, nullable
 * for system-initiated transitions.
 */
@Entity({ name: 'order_status_histories' })
@Index('IDX_order_status_histories_order_id', ['orderId'])
export class OrderStatusHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: OrderStatus })
  toStatus: OrderStatus;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: OrderActorType,
    enumName: 'order_status_histories_actor_type_enum',
  })
  actorType: OrderActorType;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
