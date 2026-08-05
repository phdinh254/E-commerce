import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Metadata-only update — never re-uploads the binary. `variantId` linkage
 * is deliberately a separate endpoint (PATCH .../images/:imageId/variant,
 * Ch11-B105), not folded in here, to keep this DTO's whitelist small and
 * the two concerns (display metadata vs. variant ownership) independently
 * auditable.
 */
export class UpdateProductImageDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'Mặt trước sản phẩm' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  altText?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  displayOrder?: number;
}
