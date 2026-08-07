import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../cart/enums/order-status.enum';
import { PaymentProvider } from '../../payments/enums/payment-provider.enum';

/**
 * Whitelisted projection of `OrderEntity` for the customer order list —
 * never `userId`, never raw entity fields. `paymentMethod` is not a column
 * on `OrderEntity` (there is none); it's derived from the latest
 * `PaymentEntity` row for the order (see `OrdersService.listForUser`), and
 * is `null` for an order that somehow has no payment row yet.
 */
export class OrderSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentProvider, nullable: true })
  paymentMethod: PaymentProvider | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  itemCount: number;
}

export class PaginatedOrderSummaryResponseDto {
  @ApiProperty({ type: [OrderSummaryResponseDto] })
  data: OrderSummaryResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}
