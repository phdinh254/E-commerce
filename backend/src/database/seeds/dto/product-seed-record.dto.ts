import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;
const MAX_PRICE_VND = 999_999_999_999;

export class ProductSeedRecordDto {
  @IsString()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase, matching product SKU convention',
  })
  sku: string;

  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case' })
  slug: string;

  @IsString()
  @MaxLength(255)
  name: string;

  /** Must reference a `slug` present in categories.json. */
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN)
  categorySlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_VND)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  featuredOrder?: number;
}
