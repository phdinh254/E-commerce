import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const CODE_MAX_LENGTH = 50;

/** Used by preview/apply — never carries subtotal/userId/cartId/price. */
export class CouponCodeDto {
  @ApiProperty({ example: 'WELCOME10', maxLength: CODE_MAX_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(CODE_MAX_LENGTH)
  code: string;
}
