import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/** Never the raw PayOS SDK response — only the fields the client needs. */
export class CheckoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  paymentId: string;

  @ApiProperty({ enum: PaymentProvider })
  paymentMethod: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Chỉ có với PAYOS' })
  checkoutUrl: string | null;
}
