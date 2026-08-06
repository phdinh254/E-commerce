import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { IDEMPOTENCY_KEY_HEADER } from '../cart/cart.constants';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from '../payments/dto/create-checkout.dto';
import { CheckoutResponseDto } from '../payments/dto/checkout-response.dto';

/**
 * Bare authenticated controller, same convention as CartController — no
 * @Public()/@Roles(), any authenticated role may check out their own cart.
 * userId always comes from @CurrentUser(), never from the request body.
 */
@ApiTags('checkout')
@ApiBearerAuth()
@Controller({ path: 'checkout' })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('cod')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt hàng thanh toán khi nhận hàng (COD)' })
  @ApiResponse({ status: 200, type: CheckoutResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Giỏ hàng trống hoặc thiếu Idempotency-Key',
  })
  placeCod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
  ): Promise<CheckoutResponseDto> {
    this.requireIdempotencyKey(idempotencyKey);
    return this.checkoutService.placeCodOrder(
      user.id,
      dto,
      idempotencyKey as string,
    );
  }

  @Post('payos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt hàng và tạo liên kết thanh toán PayOS' })
  @ApiResponse({ status: 200, type: CheckoutResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Giỏ hàng trống hoặc thiếu Idempotency-Key',
  })
  @ApiResponse({
    status: 503,
    description: 'PayOS chưa được cấu hình / không khả dụng',
  })
  placePayOs(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
  ): Promise<CheckoutResponseDto> {
    this.requireIdempotencyKey(idempotencyKey);
    return this.checkoutService.placePayOsOrder(
      user.id,
      dto,
      idempotencyKey as string,
    );
  }

  private requireIdempotencyKey(key: string | undefined): void {
    if (!key) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Header Idempotency-Key là bắt buộc',
      });
    }
  }
}
