import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PRODUCT_SORT_FIELDS = [
  'relevance',
  'name',
  'price',
  'createdAt',
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 255;

export class QueryProductDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

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

  /**
   * Normalized (trimmed, whitespace-collapsed, lowercased) here in the DTO
   * so an equivalent query always produces the same cache key downstream —
   * the SQL layer's ILIKE is already case-insensitive regardless.
   */
  @ApiPropertyOptional({
    description: 'Tìm theo tên sản phẩm hoặc SKU',
    maxLength: MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').toLowerCase()
      : value,
  )
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo danh mục' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: PRODUCT_SORT_FIELDS,
    description:
      '"relevance" chỉ có ý nghĩa khi có "search"; nếu bỏ trống, mặc định là relevance khi có search, ngược lại là createdAt',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy?: ProductSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}
