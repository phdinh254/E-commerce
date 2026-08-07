import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OrdersService } from './orders.service';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { PaginatedOrderSummaryResponseDto } from './dto/order-summary-response.dto';
import { OrderDetailResponseDto } from './dto/order-detail-response.dto';

/**
 * No `@UseGuards(...)` here — a global JWT auth guard is applied app-wide
 * with `@Public()` as the opt-out (same convention as `CheckoutController`).
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller({ path: 'orders' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn hàng của người dùng hiện tại' })
  @ApiResponse({ status: 200, type: PaginatedOrderSummaryResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryOrdersDto,
  ): Promise<PaginatedOrderSummaryResponseDto> {
    return this.ordersService.listForUser(user.id, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Chi tiết một đơn hàng của người dùng hiện tại' })
  @ApiResponse({ status: 200, type: OrderDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<OrderDetailResponseDto> {
    return this.ordersService.getDetailForUser(orderId, user.id);
  }
}
