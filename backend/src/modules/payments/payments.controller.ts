import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Webhook } from '@payos/node';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaymentsService } from './payments.service';
import { PaymentStatusResponseDto } from './dto/payment-status-response.dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Public by necessity — PayOS calls this directly, no user session
   * exists. Authenticity comes entirely from `verifyWebhookData` (signature
   * check inside `PaymentsService.processWebhook`), never from this route
   * being reachable only by trusted parties. Always 200s on any handled
   * outcome (including duplicate/mismatch, which are logged, not thrown) so
   * PayOS doesn't infinitely retry a webhook we've already dealt with;
   * unverified-signature and unexpected errors still propagate as non-2xx.
   */
  @Public()
  @Post('payments/payos/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[PayOS] Nhận webhook xác nhận thanh toán' })
  async handleWebhook(@Body() body: Webhook): Promise<{ received: true }> {
    await this.paymentsService.processWebhook(body);
    return { received: true };
  }

  @Post('payments/:paymentId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đồng bộ trạng thái thanh toán từ PayOS (dự phòng webhook)',
  })
  @ApiResponse({ status: 200, type: PaymentStatusResponseDto })
  syncStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentsService.syncStatus(paymentId, user.id);
  }

  @Get('orders/:orderId/payment-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đọc trạng thái thanh toán mới nhất của một đơn hàng',
  })
  @ApiResponse({ status: 200, type: PaymentStatusResponseDto })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentsService.getStatus(orderId, user.id);
  }
}
