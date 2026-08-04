import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SKU_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;
const MAX_PRICE_VND = 999_999_999_999;

export class CreateProductVariantDto {
  /** Always normalized to uppercase, trimmed server-side. */
  @ApiProperty({ example: 'TSHIRT-RED-M', maxLength: 64 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message:
      'sku chỉ được chứa chữ hoa, số, dấu gạch ngang hoặc gạch dưới, không bắt đầu/kết thúc bằng ký tự đặc biệt',
  })
  sku: string;

  /** Optional — falls back to the parent Product's current price (a
   * one-time snapshot, not a live link) when omitted. */
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_VND })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_VND)
  price?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  stock?: number;

  @ApiProperty({ type: [String], format: 'uuid', minItems: 1 })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  optionValueIds: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
