import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../cart/enums/order-status.enum';
import { PaymentProvider } from '../../payments/enums/payment-provider.enum';
import { OrderHistoryEntryDto } from './order-history-response.dto';

/**
 * Item snapshot fields (`productName`/`sku`/`imageUrl`) come from
 * `OrderItemEntity.productNameSnapshot`/`skuSnapshot`/`imageUrlSnapshot`,
 * which are currently NULL for every existing order (the checkout
 * finalization step that populates them is a later, not-yet-dispatched
 * task). Passed through as-is — null in, null out, never a live Product
 * lookup as a workaround.
 */
export class OrderItemDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ nullable: true })
  variantId: string | null;

  @ApiProperty({ nullable: true })
  productName: string | null;

  @ApiProperty({ nullable: true })
  sku: string | null;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPriceAmount: number;

  @ApiProperty()
  lineTotal: number;
}

/**
 * Snapshot fields copied onto `OrderEntity` at checkout time — survives
 * deletion of the source `AddressEntity`.
 */
export class ShippingAddressSnapshotDto {
  @ApiProperty({ nullable: true })
  recipientName: string | null;

  @ApiProperty({ nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ nullable: true })
  province: string | null;

  @ApiProperty({ nullable: true })
  district: string | null;

  @ApiProperty({ nullable: true })
  ward: string | null;

  @ApiProperty({ nullable: true })
  streetAddress: string | null;

  @ApiProperty({ nullable: true })
  note: string | null;
}

/**
 * Whitelisted projection for order detail — never PayOS payload/signature,
 * never `userId`, never raw entities. `OrderEntity` has no
 * `shippingFeeAmount` column (verified in the entity), so that field is
 * intentionally omitted rather than fabricated.
 */
export class OrderDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentProvider, nullable: true })
  paymentMethod: PaymentProvider | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [OrderItemDetailDto] })
  items: OrderItemDetailDto[];

  @ApiProperty()
  subtotalAmount: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ type: ShippingAddressSnapshotDto })
  shippingAddress: ShippingAddressSnapshotDto;

  @ApiProperty({ type: [OrderHistoryEntryDto] })
  history: OrderHistoryEntryDto[];
}
