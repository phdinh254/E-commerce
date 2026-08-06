import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusHistoryEntity } from './entities/order-status-history.entity';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';
import { CartRepository } from './cart.repository';
import { IdempotencyRepository } from './idempotency.repository';
import { CartMapper } from './cart.mapper';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      IdempotencyKeyEntity,
    ]),
    ProductsModule,
  ],
  controllers: [CartController],
  providers: [CartRepository, IdempotencyRepository, CartMapper, CartService],
  exports: [CartService],
})
export class CartModule {}
