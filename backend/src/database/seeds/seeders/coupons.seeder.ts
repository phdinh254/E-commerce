import { EntityManager } from 'typeorm';
import { CouponEntity } from '../../../modules/coupons/entities/coupon.entity';
import { CouponSeedRecordDto } from '../dto/coupon-seed-record.dto';

export interface CouponsSeedResult {
  created: number;
  updated: number;
}

/**
 * Natural key: code (case-insensitive, matches `UQ_coupons_code_upper`).
 * Never touches `usedCount` — Chapter 12 does not seed Orders, so there is
 * no real redemption to reflect; every seeded/updated coupon's usedCount
 * stays at its DB default (0) unless a future chapter's redemption flow
 * changes it.
 */
export async function seedCoupons(
  manager: EntityManager,
  records: CouponSeedRecordDto[],
  categorySlugToId: Map<string, string>,
  productSlugToId: Map<string, string>,
): Promise<CouponsSeedResult> {
  const repository = manager.getRepository(CouponEntity);
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const normalizedCode = record.code.trim().toUpperCase();
    const applicableCategoryId = record.applicableCategorySlug
      ? (categorySlugToId.get(record.applicableCategorySlug) ?? null)
      : null;
    const applicableProductId = record.applicableProductSlug
      ? (productSlugToId.get(record.applicableProductSlug) ?? null)
      : null;

    const existing = await repository.findOne({
      where: { code: normalizedCode },
    });
    if (existing) {
      existing.discountType = record.discountType;
      existing.discountValue = record.discountValue;
      existing.minOrderAmount = record.minOrderAmount ?? 0;
      existing.maxDiscountAmount = record.maxDiscountAmount ?? null;
      existing.startsAt = new Date(record.startsAt);
      existing.endsAt = new Date(record.endsAt);
      existing.usageLimit = record.usageLimit ?? null;
      existing.perUserLimit = record.perUserLimit ?? null;
      existing.isActive = record.isActive ?? existing.isActive;
      existing.applicableCategoryId = applicableCategoryId;
      existing.applicableProductId = applicableProductId;
      await repository.save(existing);
      updated += 1;
      continue;
    }

    const createdEntity = repository.create({
      code: normalizedCode,
      discountType: record.discountType,
      discountValue: record.discountValue,
      minOrderAmount: record.minOrderAmount ?? 0,
      maxDiscountAmount: record.maxDiscountAmount ?? null,
      startsAt: new Date(record.startsAt),
      endsAt: new Date(record.endsAt),
      usageLimit: record.usageLimit ?? null,
      perUserLimit: record.perUserLimit ?? null,
      isActive: record.isActive ?? true,
      applicableCategoryId,
      applicableProductId,
    });
    await repository.save(createdEntity);
    created += 1;
  }

  return { created, updated };
}
