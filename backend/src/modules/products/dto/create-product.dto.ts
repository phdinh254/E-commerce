import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { slugify } from '../../../common/utils/slug.util';

const SLUG_MAX_LENGTH = 255;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;
const MAX_PRICE_VND = 999_999_999_999;

export class CreateProductDto {
  @ApiProperty({ example: 'Áo thun nam basic', maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** Optional client-suggested slug — always normalized server-side. */
  @ApiPropertyOptional({
    example: 'ao-thun-nam-basic',
    description:
      'Đề xuất slug (tùy chọn); backend luôn chuẩn hóa giá trị cuối cùng',
    maxLength: SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? slugify(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  slug?: string;

  /**
   * Always normalized to uppercase, trimmed server-side (see
   * ProductsService) — client casing/whitespace never reaches storage.
   */
  @ApiProperty({ example: 'ATN-BASIC-001', maxLength: 64 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message:
      'sku chỉ được chứa chữ hoa, số, dấu gạch ngang hoặc gạch dưới, không bắt đầu/kết thúc bằng ký tự đặc biệt',
  })
  sku: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  description?: string;

  /** Integer VND amount. 0 is allowed (e.g. promotional giveaways). */
  @ApiProperty({ example: 199000, minimum: 0, maximum: MAX_PRICE_VND })
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_VND)
  price: number;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

  @ApiProperty({ description: 'ID danh mục — bắt buộc' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  featuredOrder?: number;
}
