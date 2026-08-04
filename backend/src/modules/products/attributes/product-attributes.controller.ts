import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ProductAttributesService } from './product-attributes.service';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { ProductAttributeResponseDto } from './dto/product-attribute-response.dto';

@ApiTags('product-attributes')
@Controller({ path: 'products/:productId/attributes' })
export class ProductAttributesController {
  constructor(private readonly attributesService: ProductAttributesService) {}

  @AdminOnly()
  @Post()
  @ApiOperation({ summary: 'Tạo thuộc tính mô tả cho sản phẩm (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 201, type: ProductAttributeResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  @ApiConflictResponse({ description: 'Tên thuộc tính đã tồn tại' })
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductAttributeDto,
  ): Promise<ProductAttributeResponseDto> {
    return this.attributesService.create(productId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách thuộc tính hiển thị công khai của sản phẩm',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ProductAttributeResponseDto] })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  list(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductAttributeResponseDto[]> {
    return this.attributesService.listPublic(productId);
  }

  @AdminOnly()
  @Patch(':attributeId')
  @ApiOperation({ summary: 'Cập nhật thuộc tính (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'attributeId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductAttributeResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Payload rỗng hoặc dữ liệu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy thuộc tính của sản phẩm này',
  })
  @ApiConflictResponse({ description: 'Tên thuộc tính đã tồn tại' })
  update(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Body() dto: UpdateProductAttributeDto,
  ): Promise<ProductAttributeResponseDto> {
    return this.attributesService.update(productId, attributeId, dto);
  }

  @AdminOnly()
  @Delete(':attributeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mềm thuộc tính (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'attributeId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Đã xóa mềm thuộc tính' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy thuộc tính của sản phẩm này',
  })
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
  ): Promise<void> {
    return this.attributesService.remove(productId, attributeId);
  }
}
