import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;
}

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  sku: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Giá tính bằng VND (số nguyên)' })
  price: number;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  featuredOrder: number;

  @ApiPropertyOptional({ type: CategoryRefDto, nullable: true })
  category: CategoryRefDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedProductResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items: ProductResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/** Minimal landing/featured projection — no long description or audit fields. */
export class FeaturedProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  price: number;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  shortDescription: string | null;

  @ApiPropertyOptional({ type: CategoryRefDto, nullable: true })
  category: CategoryRefDto | null;
}

export class SuggestionResponseDto {
  @ApiProperty({ type: [String] })
  data: string[];
}
