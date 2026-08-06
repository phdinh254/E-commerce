import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusHistoryEntity } from './entities/order-status-history.entity';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';
import { CartRepository } from './cart.repository';
import { CartCouponRepository } from './cart-coupon.repository';
import { IdempotencyRepository } from './idempotency.repository';
import { CartMapper } from './cart.mapper';
import { CartPricingService } from './cart-pricing.service';
import { CartService } from './cart.service';
import { CartCouponService } from './cart-coupon.service';
import { CartController } from './cart.controller';
import { CartCouponController } from './cart-coupon.controller';
import { ProductsModule } from '../products/products.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      IdempotencyKeyEntity,
    ]),
    ProductsModule,
    CouponsModule,
  ],
  controllers: [CartController, CartCouponController],
  providers: [
    CartRepository,
    CartCouponRepository,
    IdempotencyRepository,
    CartMapper,
    CartPricingService,
    CartService,
    CartCouponService,
  ],
  exports: [CartService],
})
export class CartModule {}
