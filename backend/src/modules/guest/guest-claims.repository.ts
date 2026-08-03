import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestClaimEntity } from './entities/guest-claim.entity';

export type ClaimInsertOutcome =
  | { kind: 'inserted'; claim: GuestClaimEntity }
  | { kind: 'already-claimed'; claim: GuestClaimEntity };

@Injectable()
export class GuestClaimsRepository {
  constructor(
    @InjectRepository(GuestClaimEntity)
    private readonly repository: Repository<GuestClaimEntity>,
  ) {}

  /**
   * Atomic idempotency check-and-insert in one round trip: relies on the
   * unique constraint on `guest_id`, not on any application-level locking.
   * Two concurrent callers racing on the same guestId will have exactly one
   * `INSERT` succeed; the other reads back the row the winner just wrote.
   */
  async insertIfAbsent(
    guestId: string,
    userId: string,
  ): Promise<ClaimInsertOutcome> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(GuestClaimEntity)
      .values({ guestId, userId })
      .orIgnore()
      .returning('*')
      .execute();

    const raw = result.raw as GuestClaimEntity[];
    if (raw.length > 0) {
      return { kind: 'inserted', claim: raw[0] };
    }

    const existing = await this.repository.findOneOrFail({
      where: { guestId },
    });
    return { kind: 'already-claimed', claim: existing };
  }

  findByGuestId(guestId: string): Promise<GuestClaimEntity | null> {
    return this.repository.findOne({ where: { guestId } });
  }
}
