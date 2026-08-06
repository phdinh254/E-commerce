import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  itemId: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  variantId: string | null;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  sku: string;

  @ApiPropertyOptional({ nullable: true })
  image: string | null;

  @ApiPropertyOptional({ nullable: true, type: [String] })
  selectedOptions: string[] | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ description: 'Giá đơn vị backend đã resolve, tính bằng VND' })
  unitPrice: number;

  @ApiProperty({ description: 'unitPrice * quantity, tính bằng VND' })
  lineTotal: number;

  @ApiProperty()
  available: boolean;

  @ApiPropertyOptional({ nullable: true })
  unavailableReason: string | null;
}

export class CartResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cartId: string | null;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({
    description: 'Tổng quantity của mọi dòng, không phải số dòng',
  })
  totalQuantity: number;

  @ApiProperty({ description: 'Tổng tiền các dòng, tính bằng VND' })
  subtotal: number;

  @ApiProperty({ description: 'VND' })
  currency: 'VND';

  @ApiPropertyOptional({ nullable: true })
  updatedAt: Date | null;
}
