import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';

export type IdempotencyInsertOutcome =
  | { kind: 'inserted'; record: IdempotencyKeyEntity }
  | { kind: 'existing'; record: IdempotencyKeyEntity };

@Injectable()
export class IdempotencyRepository {
  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly repository: Repository<IdempotencyKeyEntity>,
  ) {}

  /**
   * Atomic idempotency check-and-insert, same shape as
   * GuestClaimsRepository.insertIfAbsent: relies on the unique constraint
   * on (user_id, operation, idempotency_key), not application-level
   * locking. Accepts an optional `manager` so the caller (CartService) can
   * run this inside the SAME transaction as the cart mutation — a request
   * that fails mid-transaction must not leave an idempotency row pointing
   * at a mutation that never committed.
   */
  async insertPlaceholder(
    params: {
      userId: string;
      operation: string;
      idempotencyKey: string;
      requestHash: string;
    },
    manager?: EntityManager,
  ): Promise<IdempotencyInsertOutcome> {
    const repo = manager
      ? manager.getRepository(IdempotencyKeyEntity)
      : this.repository;

    const result = await repo
      .createQueryBuilder()
      .insert()
      .into(IdempotencyKeyEntity)
      .values({
        userId: params.userId,
        operation: params.operation,
        idempotencyKey: params.idempotencyKey,
        requestHash: params.requestHash,
        // Placeholder values — overwritten by recordResponse() once the
        // mutation's real outcome is known, in the same transaction.
        // responseBody can't be SQL NULL (column is NOT NULL); {} signals
        // "not yet recorded" and is checked via responseStatus === 0.
        responseStatus: 0,
        responseBody: {},
      })
      .orIgnore()
      .returning('*')
      .execute();

    const raw = result.raw as IdempotencyKeyEntity[];
    if (raw.length > 0) {
      return { kind: 'inserted', record: raw[0] };
    }

    const existing = await repo.findOneOrFail({
      where: {
        userId: params.userId,
        operation: params.operation,
        idempotencyKey: params.idempotencyKey,
      },
    });
    return { kind: 'existing', record: existing };
  }

  async recordResponse(
    id: string,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(IdempotencyKeyEntity)
      : this.repository;
    await repo.update({ id }, {
      responseStatus,
      responseBody,
    } as QueryDeepPartialEntity<IdempotencyKeyEntity>);
  }
}
