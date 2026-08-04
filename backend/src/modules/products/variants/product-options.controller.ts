import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ProductOptionsService } from './product-options.service';
import { CreateProductOptionDto } from './dto/create-product-option.dto';
import { CreateOptionValueDto } from './dto/create-option-value.dto';
import {
  ProductOptionResponseDto,
  ProductOptionValueResponseDto,
} from './dto/product-option-response.dto';

@ApiTags('product-options')
@Controller({ path: 'products/:productId/options' })
export class ProductOptionsController {
  constructor(private readonly optionsService: ProductOptionsService) {}

  @AdminOnly()
  @Post()
  @ApiOperation({
    summary: 'Tạo option kèm danh sách value cho sản phẩm (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 201, type: ProductOptionResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  @ApiConflictResponse({
    description:
      'Tên option/value đã tồn tại, hoặc sản phẩm đã có biến thể nên không thể thêm option mới',
  })
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductOptionDto,
  ): Promise<ProductOptionResponseDto> {
    return this.optionsService.createOption(productId, dto);
  }

  @AdminOnly()
  @Post(':optionId/values')
  @ApiOperation({ summary: 'Thêm value vào option đã có (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'optionId', format: 'uuid' })
  @ApiResponse({ status: 201, type: ProductOptionValueResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm hoặc option' })
  @ApiConflictResponse({ description: 'Value đã tồn tại trong option này' })
  addValue(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() dto: CreateOptionValueDto,
  ): Promise<ProductOptionValueResponseDto> {
    return this.optionsService.addValue(productId, optionId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách option (kèm value) của sản phẩm' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ProductOptionResponseDto] })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  list(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductOptionResponseDto[]> {
    return this.optionsService.listOptions(productId);
  }
}
