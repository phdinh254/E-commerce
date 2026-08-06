import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { OrderStatus } from '../../cart/enums/order-status.enum';

/**
 * Response for both the polling status endpoint and the sync endpoint —
 * never the raw Payment entity (no internal metadata, no provider payload,
 * no failure stack traces).
 */
export class PaymentStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  paymentId: string;

  @ApiProperty({ enum: PaymentProvider })
  paymentMethod: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: OrderStatus })
  orderStatus: OrderStatus;

  @ApiProperty({ description: 'VND' })
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiProperty({ description: 'true khi paymentStatus không còn thay đổi nữa' })
  isTerminal: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Chỉ có khi paymentStatus=PENDING và là PAYOS',
  })
  checkoutUrl: string | null;
}
