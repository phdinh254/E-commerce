import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ProductImageSeedRecordDto {
  /** Must reference a `slug` present in products.json. */
  @IsString()
  @MaxLength(255)
  productSlug: string;

  /** Omitted = Product-level image. If present, must reference a `sku` present in product-variants.json for the same product. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  variantSku?: string;

  /** File name under src/database/seeds/assets/ — the shared fixture binary. */
  @IsString()
  @MaxLength(255)
  assetFile: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
