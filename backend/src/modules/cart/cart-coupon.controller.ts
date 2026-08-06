import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Put,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CartCouponService } from './cart-coupon.service';
import { CouponCodeDto } from '../coupons/dto/coupon-code.dto';
import { CouponPreviewResponseDto } from '../coupons/dto/coupon-preview-response.dto';
import { CartResponseDto } from './dto/cart-response.dto';

/**
 * Bare authenticated routes (JwtAuthGuard global, any role) — same
 * ownership convention as CartController: user/Cart always resolved from
 * @CurrentUser(), never from a client-supplied cartId/userId.
 * Throttled like auth.controller.ts's public endpoints to slow down
 * coupon-code enumeration.
 */
@ApiTags('cart-coupon')
@ApiBearerAuth()
@Controller({ path: 'cart/coupon' })
export class CartCouponController {
  constructor(private readonly cartCouponService: CartCouponService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('preview')
  @ApiOperation({
    summary: 'Xem trước mã giảm giá cho Cart hiện tại — không mutate',
  })
  @ApiResponse({ status: 200, type: CouponPreviewResponseDto })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CouponCodeDto,
  ): Promise<CouponPreviewResponseDto> {
    return this.cartCouponService.previewCoupon(user.id, dto.code);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put()
  @ApiOperation({
    summary: 'Áp dụng (hoặc thay thế) mã giảm giá cho Cart hiện tại',
  })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 400, description: 'Mã giảm giá không hợp lệ' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy Cart hoặc mã giảm giá',
  })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CouponCodeDto,
  ): Promise<CartResponseDto> {
    return this.cartCouponService.applyCoupon(user.id, dto.code);
  }

  @Delete()
  @ApiOperation({ summary: 'Gỡ mã giảm giá khỏi Cart hiện tại — idempotent' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<CartResponseDto> {
    return this.cartCouponService.removeCoupon(user.id);
  }
}
