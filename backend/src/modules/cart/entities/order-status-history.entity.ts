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

/**
 * Chapter 15 writes exactly one row per order (to=CART) when the cart is
 * first created. Per-quantity-change mutations are NOT status transitions
 * and do not write here — only Order.status changes do. Checkout (later
 * chapter) will add the CART -> PENDING_PAYMENT -> PAID transitions.
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

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
