import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_PRICE_VND = 999_999_999_999;

/**
 * This is an administrative absolute-set operation, not a delta/reservation
 * — see docs/product-variant-business-rules.md. `reason` is always
 * required (kept simple rather than conditionally required only when a
 * value actually changes) — the service is what decides whether a no-op
 * (new value equals old value, or price/stock/isActive all omitted)
 * creates no audit rows.
 */
export class UpdateProductVariantDto {
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_VND })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_VND)
  price?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'Cập nhật giá và tồn kho sau khi nhập hàng',
    maxLength: 500,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
