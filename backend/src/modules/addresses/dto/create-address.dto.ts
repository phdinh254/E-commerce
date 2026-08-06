import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const PHONE_PATTERN = /^(0|\+84)[0-9]{9,10}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Never accepts id/userId/createdAt/updatedAt/deletedAt from the client —
 * owner is always the JWT subject (see AddressesController), timestamps are
 * server-generated. `isDefault` here may be `true` (this address becomes
 * the new default) or omitted; there is no "create as explicitly not
 * default" concept — every address is either the default or not, decided by
 * AddressesService (first address always becomes default regardless of
 * this flag).
 */
export class CreateAddressDto {
  @ApiPropertyOptional({ maxLength: 100, example: 'Nhà riêng' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  recipientName: string;

  @ApiProperty({ example: '0912345678' })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ' })
  phoneNumber: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  province: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  district: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ward: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  streetAddress: string;

  @ApiPropertyOptional({
    description:
      'Đặt địa chỉ này làm mặc định. Địa chỉ đầu tiên của user luôn tự động là mặc định bất kể giá trị này.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
