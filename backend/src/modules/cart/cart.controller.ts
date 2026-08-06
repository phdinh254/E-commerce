import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { IDEMPOTENCY_KEY_HEADER } from './cart.constants';

/**
 * No @Public()/@Roles()/@AdminOnly() on any route here — a "bare"
 * controller under the global JwtAuthGuard+RolesGuard requires a valid JWT
 * by default and allows any authenticated role (CUSTOMER or ADMIN), same
 * convention already used elsewhere for non-admin-gated authenticated
 * endpoints. userId always comes from @CurrentUser() (the verified JWT
 * subject) — never accepted from body/query/header.
 */
@ApiTags('cart')
@ApiBearerAuth()
@Controller({ path: 'cart' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng hiện tại của user đã đăng nhập' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  getCart(@CurrentUser() user: AuthenticatedUser): Promise<CartResponseDto> {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm sản phẩm/biến thể vào giỏ hàng' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc thiếu Idempotency-Key',
  })
  @ApiResponse({
    status: 404,
    description: 'Product hoặc Variant không tồn tại',
  })
  @ApiResponse({ status: 409, description: 'Idempotency-Key xung đột' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
  ): Promise<CartResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Header Idempotency-Key là bắt buộc',
      });
    }
    return this.cartService.addItem(user.id, dto, idempotencyKey);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Đặt lại số lượng tuyệt đối cho một dòng giỏ hàng' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dòng giỏ hàng' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItemQuantity(user.id, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa một dòng khỏi giỏ hàng' })
  @ApiResponse({
    status: 204,
    description: 'Đã xóa (idempotent với chính user)',
  })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.cartService.removeItem(user.id, itemId);
  }
}
