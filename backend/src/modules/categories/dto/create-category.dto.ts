import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
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

export class CreateCategoryDto {
  @ApiProperty({ example: 'Điện thoại', maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /**
   * Optional client-suggested slug. Always normalized server-side via
   * `slugify` before validation/storage — the client never controls the
   * final slug value directly, only proposes source text for it.
   */
  @ApiPropertyOptional({
    example: 'dien-thoai',
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

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'ID danh mục cha (bỏ trống để tạo danh mục gốc)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
