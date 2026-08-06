import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponEntity } from './entities/coupon.entity';
import { CouponRedemptionEntity } from './entities/coupon-redemption.entity';
import { CouponsRepository } from './coupons.repository';
import { CouponRedemptionsRepository } from './coupon-redemptions.repository';
import { CouponValidationService } from './coupon-validation.service';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { ClockService } from '../../common/clock/clock.service';

@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, CouponRedemptionEntity])],
  controllers: [CouponsController],
  providers: [
    ClockService,
    CouponsRepository,
    CouponRedemptionsRepository,
    CouponValidationService,
    CouponsService,
  ],
  exports: [CouponsService, CouponValidationService, ClockService],
})
export class CouponsModule {}
