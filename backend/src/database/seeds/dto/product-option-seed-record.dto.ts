import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OptionValueSeedRecordDto {
  @IsString()
  @MaxLength(100)
  value: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

/** One record = one Option (with its values) belonging to one Product. */
export class ProductOptionSeedRecordDto {
  /** Must reference a `slug` present in products.json. */
  @IsString()
  @MaxLength(255)
  productSlug: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OptionValueSeedRecordDto)
  values: OptionValueSeedRecordDto[];
}
