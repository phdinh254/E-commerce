import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AdminOnly } from '../../guest/decorators/admin-only.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ProductVariantsService } from './product-variants.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { VariantAuditQueryDto } from './dto/variant-audit-query.dto';
import { ProductVariantResponseDto } from './dto/product-variant-response.dto';
import { PaginatedVariantAuditLogResponseDto } from './dto/variant-audit-log-response.dto';

@ApiTags('product-variants')
@Controller({ path: 'products/:productId/variants' })
export class ProductVariantsController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  @AdminOnly()
  @Post()
  @ApiOperation({ summary: 'Tạo biến thể từ tổ hợp option value (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 201, type: ProductVariantResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu hoặc tổ hợp không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  @ApiConflictResponse({
    description: 'Trùng SKU hoặc trùng tổ hợp option value',
  })
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
  ): Promise<ProductVariantResponseDto> {
    return this.variantsService.createVariant(productId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách biến thể đang hoạt động của sản phẩm',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ProductVariantResponseDto] })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  list(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductVariantResponseDto[]> {
    return this.variantsService.listPublicVariants(productId);
  }

  @AdminOnly()
  @Patch(':variantId')
  @ApiOperation({
    summary:
      'Cập nhật giá/tồn kho biến thể — ghi audit log trong cùng transaction (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductVariantResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Payload rỗng hoặc dữ liệu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy biến thể của sản phẩm này',
  })
  update(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductVariantResponseDto> {
    return this.variantsService.updateVariant(
      productId,
      variantId,
      dto,
      user.id,
    );
  }

  @AdminOnly()
  @Get(':variantId/audit-logs')
  @ApiOperation({
    summary: 'Lịch sử thay đổi giá/tồn kho của biến thể (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiResponse({ status: 200, type: PaginatedVariantAuditLogResponseDto })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy biến thể của sản phẩm này',
  })
  auditLogs(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query() query: VariantAuditQueryDto,
  ): Promise<PaginatedVariantAuditLogResponseDto> {
    return this.variantsService.getAuditLogs(productId, variantId, query);
  }
}
