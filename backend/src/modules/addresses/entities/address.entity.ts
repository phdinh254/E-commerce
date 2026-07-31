import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * ON DELETE RESTRICT (not CASCADE): unlike refresh tokens, addresses carry
 * shipping history that may still have referential value later (e.g. past
 * orders). Users are only ever soft-deleted today, so this mostly guards
 * against an accidental future hard-delete silently wiping address history.
 *
 * UQ_addresses_user_default_active is a partial unique index so a user can
 * have many non-default addresses but at most one active default at a time;
 * soft-deleting the current default frees the slot for a new one.
 */
@Entity({ name: 'addresses' })
@Index('UQ_addresses_user_default_active', ['userId'], {
  unique: true,
  where: '"is_default" = true AND "deleted_at" IS NULL',
})
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.addresses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'recipient_name', type: 'varchar', length: 255 })
  recipientName: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 255 })
  province: string;

  @Column({ type: 'varchar', length: 255 })
  district: string;

  @Column({ type: 'varchar', length: 255 })
  ward: string;

  @Column({ name: 'street_address', type: 'varchar', length: 255 })
  streetAddress: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
