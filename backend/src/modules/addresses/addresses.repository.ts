import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AddressEntity } from './entities/address.entity';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class AddressesRepository {
  constructor(
    @InjectRepository(AddressEntity)
    private readonly repository: Repository<AddressEntity>,
  ) {}

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(fn);
  }

  /**
   * Locks the (always-existing) User row to serialize concurrent address
   * mutations for the same user — the same "lock a stable parent row"
   * pattern as CartRepository/CartCouponRepository locking the Order row.
   * Address rows can't be locked for a race like "create the first address
   * twice concurrently" because there is no row yet to lock; the User row
   * always exists once the JWT is valid, so it is the correct serialization
   * point. The partial unique index on (user_id) WHERE is_default remains
   * the actual DB-level guarantee — this lock only prevents the two
   * concurrent transactions from both observing "no default yet" and both
   * deciding to insert as default.
   */
  async lockUserForAddressMutation(
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(UserEntity).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
      select: { id: true },
    });
  }

  /** Default first, then deterministic (createdAt ASC, id ASC) — never an
   * unordered/implicit DB order. */
  findAllActiveByUserId(userId: string): Promise<AddressEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  /** Ownership is enforced IN the query (userId + id together) — a
   * mismatched id is indistinguishable from a non-existent one, both
   * surface as 404 to the caller (see AddressesService). */
  findOwnedActiveById(
    userId: string,
    addressId: string,
  ): Promise<AddressEntity | null> {
    return this.repository.findOne({ where: { userId, id: addressId } });
  }

  findOwnedActiveByIdForUpdate(
    userId: string,
    addressId: string,
    manager: EntityManager,
  ): Promise<AddressEntity | null> {
    return manager.getRepository(AddressEntity).findOne({
      where: { userId, id: addressId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  countActiveByUserId(userId: string, manager: EntityManager): Promise<number> {
    return manager.getRepository(AddressEntity).count({ where: { userId } });
  }

  async clearDefaultForUser(
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(AddressEntity)
      .update({ userId, isDefault: true }, { isDefault: false });
  }

  /** Deterministic replacement when the current default is deleted: oldest
   * remaining address first (createdAt ASC), id ASC as a stable tie-break —
   * never a random pick. */
  findReplacementDefaultCandidate(
    userId: string,
    excludeAddressId: string,
    manager: EntityManager,
  ): Promise<AddressEntity | null> {
    return manager
      .getRepository(AddressEntity)
      .createQueryBuilder('address')
      .where('address.user_id = :userId', { userId })
      .andWhere('address.id != :excludeAddressId', { excludeAddressId })
      .orderBy('address.created_at', 'ASC')
      .addOrderBy('address.id', 'ASC')
      .getOne();
  }

  create(data: Partial<AddressEntity>, manager: EntityManager): AddressEntity {
    return manager.getRepository(AddressEntity).create(data);
  }

  save(address: AddressEntity, manager: EntityManager): Promise<AddressEntity> {
    return manager.getRepository(AddressEntity).save(address);
  }

  async softDelete(addressId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(AddressEntity).softDelete({ id: addressId });
  }
}
