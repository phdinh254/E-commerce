import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductAttributeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  value: string;

  @ApiPropertyOptional({ nullable: true })
  unit: string | null;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isVisible: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
