import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType } from '../entities/coupon.entity';

export class AppliedCouponDto {
  @ApiProperty()
  code: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiProperty({ enum: CouponDiscountType })
  discountType: CouponDiscountType;

  @ApiProperty()
  discountValue: number;
}
