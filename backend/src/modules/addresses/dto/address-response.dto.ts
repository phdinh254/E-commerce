import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Never the raw AddressEntity — no userId, no deletedAt, no internal
 * metadata. Field shape mirrors AddressEntity 1:1 otherwise. */
export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  label: string | null;

  @ApiProperty()
  recipientName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  province: string;

  @ApiProperty()
  district: string;

  @ApiProperty()
  ward: string;

  @ApiProperty()
  streetAddress: string;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
