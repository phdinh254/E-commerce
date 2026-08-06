import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const PHONE_PATTERN = /^(0|\+84)[0-9]{9,10}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Shared by both COD and PayOS checkout — never carries amount/subtotal/
 * total/price/userId/paymentStatus/returnUrl/cancelUrl. AddressesModule is
 * entity-only (no service), so shipping data is accepted directly here and
 * frozen onto Order at placement (see order.entity.ts shipping columns).
 */
export class CreateCheckoutDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingRecipientName: string;

  @ApiProperty({ example: '0912345678' })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ' })
  shippingPhoneNumber: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingProvince: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingDistrict: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingWard: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingStreetAddress: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  shippingNote?: string;
}
