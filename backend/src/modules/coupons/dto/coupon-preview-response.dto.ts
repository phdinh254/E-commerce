import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType } from '../entities/coupon.entity';

/** Reason codes are stable and frontend-safe to switch on — never parse `message`. */
export type CouponReasonCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT_REACHED'
  | 'COUPON_MINIMUM_NOT_MET'
  | 'COUPON_INVALID_VALUE';

export class CouponPreviewResponseDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  valid: boolean;

  @ApiPropertyOptional({ enum: CouponDiscountType, nullable: true })
  discountType: CouponDiscountType | null;

  @ApiPropertyOptional({ nullable: true })
  discountValue: number | null;

  @ApiProperty({ description: 'VND' })
  subtotal: number;

  @ApiProperty({ description: 'VND — 0 nếu không hợp lệ' })
  discountAmount: number;

  @ApiProperty({ description: 'VND — subtotal nếu không hợp lệ' })
  total: number;

  @ApiPropertyOptional({ nullable: true })
  reasonCode: CouponReasonCode | null;

  @ApiProperty()
  message: string;
}
