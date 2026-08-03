import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity({ name: 'oauth_identities' })
@Index(
  'UQ_oauth_identities_provider_account',
  ['provider', 'providerAccountId'],
  {
    unique: true,
  },
)
export class OAuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_oauth_identities_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ name: 'provider_account_id', type: 'varchar', length: 255 })
  providerAccountId: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
