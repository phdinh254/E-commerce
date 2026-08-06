import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItemEntity } from './order-item.entity';

/**
 * Cart-is-order: this row IS the user's cart while status = CART. The DB
 * enforces "at most one active CART order per user" via a partial unique
 * index on (user_id) WHERE status = 'CART' (see the Ch15 migration) — not
 * merely a service-level check, so it survives concurrent requests.
 *
 * subtotal/total are integer VND, recomputed server-side from order_items
 * on every mutation — never trusted from the client. total = subtotal in
 * this chapter (no shipping/discount yet); the column exists now so a
 * later checkout chapter does not need a schema change.
 */
@Entity({ name: 'orders' })
@Index('IDX_orders_user_id', ['userId'])
@Index('IDX_orders_status', ['status'])
// Partial unique index (WHERE status = 'CART') — not expressible through
// plain TypeORM decorator options, declared in the Ch15 migration.
// `synchronize: false` documentation-only, same pattern as
// ProductAttributeEntity's partial unique index.
@Index('UQ_orders_user_id_active_cart', {
  unique: true,
  synchronize: false,
} as unknown as { synchronize: false })
@Check('CHK_orders_subtotal_amount_non_negative', '"subtotal_amount" >= 0')
@Check('CHK_orders_total_amount_non_negative', '"total_amount" >= 0')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CART })
  status: OrderStatus;

  @Column({ name: 'subtotal_amount', type: 'integer', default: 0 })
  subtotalAmount: number;

  @Column({ name: 'total_amount', type: 'integer', default: 0 })
  totalAmount: number;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: OrderItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
