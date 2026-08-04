import { ApiProperty } from '@nestjs/swagger';

export class VariantOptionValueRefDto {
  @ApiProperty()
  optionId: string;

  @ApiProperty()
  optionName: string;

  @ApiProperty()
  valueId: string;

  @ApiProperty()
  value: string;
}

export class ProductVariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ description: 'Giá tính bằng VND (số nguyên)' })
  price: number;

  @ApiProperty()
  stock: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [VariantOptionValueRefDto] })
  optionValues: VariantOptionValueRefDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
