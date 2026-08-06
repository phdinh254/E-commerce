import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentWebhookEventEntity } from './entities/payment-webhook-event.entity';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsRepository } from './payments.repository';
import { PaymentWebhookEventsRepository } from './payment-webhook-events.repository';
import { PaymentTransitionService } from './payment-transition.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_GATEWAY } from './payos-gateway.interface';
import { PayOsGatewayService } from './payos-gateway.service';

/**
 * Depends on Cart (OrderEntity/OrderStatusHistoryEntity — payment
 * confirmation mutates Order) and Coupons (redeemForOrder) directly, since
 * the webhook/sync transition path finalizes an Order independent of
 * Checkout ever being invoked in the same request. This does not create a
 * cycle: Cart and Coupons never import Payment.
 *
 * The real `PayOsGatewayService` is the default `PAYMENT_GATEWAY` binding;
 * tests override it via `overrideProvider(PAYMENT_GATEWAY)` with
 * `FakePayOsGateway` — production code never imports the fake.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentWebhookEventEntity,
      OrderEntity,
      OrderStatusHistoryEntity,
    ]),
    CouponsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentWebhookEventsRepository,
    PaymentTransitionService,
    PaymentsService,
    { provide: PAYMENT_GATEWAY, useClass: PayOsGatewayService },
  ],
  exports: [PaymentsRepository, PaymentTransitionService, PAYMENT_GATEWAY],
})
export class PaymentsModule {}
