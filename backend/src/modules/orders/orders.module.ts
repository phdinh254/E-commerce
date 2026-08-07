import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderItemEntity } from '../cart/entities/order-item.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * `PaymentEntity` is registered here (in addition to `OrderEntity`/
 * `OrderItemEntity`) because `paymentMethod` is not a column on
 * `OrderEntity` — it must be derived by querying `payments` directly (see
 * `OrdersService.listForUser`'s batched lookup). `PaymentsModule` is
 * imported to reach `OrderHistoryService` and `PaymentsRepository` (mirrors
 * how `CheckoutModule` already reaches `OrderHistoryService`) — relocating
 * `OrderHistoryService` out of `PaymentsModule` is explicitly out of scope.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, PaymentEntity]),
    PaymentsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
