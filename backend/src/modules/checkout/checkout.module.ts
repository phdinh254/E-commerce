import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';
import { AddressesModule } from '../addresses/addresses.module';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';

/**
 * One-directional dependency: Checkout -> {Cart, Coupons, Payment,
 * Addresses}. Never the reverse — Cart/Coupons/Payment/Addresses must never
 * import Checkout.
 */
@Module({
  imports: [CartModule, CouponsModule, PaymentsModule, AddressesModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
