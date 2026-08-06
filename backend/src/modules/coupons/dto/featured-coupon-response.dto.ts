import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType } from '../entities/coupon.entity';

/**
 * Marketing-safe projection only — no usageCount, usedCount, deletedAt, or
 * any redemption/internal metadata. Appearing here is not a guarantee a
 * given Cart can actually redeem it (usage limit/minimum are re-checked at
 * preview/apply time).
 */
export class FeaturedCouponResponseDto {
  @ApiProperty()
  code: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: CouponDiscountType })
  discountType: CouponDiscountType;

  @ApiProperty()
  discountValue: number;

  @ApiProperty()
  minOrderAmount: number;

  @ApiPropertyOptional({ nullable: true })
  maxDiscountAmount: number | null;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;
}
