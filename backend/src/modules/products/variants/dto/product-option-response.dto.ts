import { ApiProperty } from '@nestjs/swagger';

export class ProductOptionValueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  displayOrder: number;
}

export class ProductOptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty({ type: [ProductOptionValueResponseDto] })
  values: ProductOptionValueResponseDto[];
}
