import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponDiscountType } from '../../../modules/coupons/entities/coupon.entity';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

export class CouponSeedRecordDto {
  @IsString()
  @MaxLength(50)
  @Matches(CODE_PATTERN, {
    message: 'code must be uppercase, matching coupon code convention',
  })
  code: string;

  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @IsInt()
  @Min(1)
  @Max(999_999_999)
  discountValue: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountAmount?: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** At most one of applicableCategorySlug/applicableProductSlug — enforced in cross-file validation. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicableCategorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicableProductSlug?: string;
}
