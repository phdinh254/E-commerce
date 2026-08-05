import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class ProductAttributeSeedRecordDto {
  /** Must reference a `slug` present in products.json. */
  @IsString()
  @MaxLength(255)
  productSlug: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(500)
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
