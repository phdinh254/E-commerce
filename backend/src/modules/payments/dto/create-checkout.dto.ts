import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Shared by both COD and PayOS checkout — never carries amount/subtotal/
 * total/price/userId/paymentStatus/returnUrl/cancelUrl. `addressId` must
 * reference a saved Address owned by the authenticated user (see
 * CheckoutService — resolved and ownership-checked via AddressesService,
 * never trusted as-is); the free-text shipping fields this DTO carried
 * before Ch18 are gone; a client can no longer submit an unverified
 * recipient/phone/street for an order. `shippingNote` remains a per-order
 * instruction (e.g. "giao giờ hành chính"), independent of the saved
 * Address's own `label`.
 */
export class CreateCheckoutDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Địa chỉ giao hàng đã lưu, thuộc user hiện tại',
  })
  @IsUUID()
  addressId: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  shippingNote?: string;
}
