import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SKU_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;
const MAX_PRICE_VND = 999_999_999_999;

/** Selects exactly one value of one option — e.g. { optionName: "Màu sắc", value: "Đỏ" }. */
export class VariantOptionValueRefSeedRecordDto {
  @IsString()
  @MaxLength(100)
  optionName: string;

  @IsString()
  @MaxLength(100)
  value: string;
}

export class ProductVariantSeedRecordDto {
  /** Must reference a `slug` present in products.json. */
  @IsString()
  @MaxLength(255)
  productSlug: string;

  @IsString()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase, matching variant SKU convention',
  })
  sku: string;

  /** Must cover every Option declared for this product in product-options.json — no missing/extra. */
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantOptionValueRefSeedRecordDto)
  optionValues: VariantOptionValueRefSeedRecordDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_VND)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
