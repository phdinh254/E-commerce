import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_QUERY_LENGTH = 100;

export class SuggestionQueryDto {
  /**
   * Minimum length 2: a single character over a large catalog is an
   * expensive, low-value prefix scan — reject it outright (400) rather than
   * silently running it or silently returning an empty list.
   */
  @ApiProperty({ minLength: 2, maxLength: MAX_QUERY_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_QUERY_LENGTH)
  q: string;

  @ApiPropertyOptional({
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
