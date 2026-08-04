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
import { Public } from '../../common/decorators/public.decorator';
import { AdminOnly } from '../guest/decorators/admin-only.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { SuggestionQueryDto } from './dto/suggestion-query.dto';
import { FeaturedQueryDto } from './dto/featured-query.dto';
import {
  FeaturedProductResponseDto,
  PaginatedProductResponseDto,
  ProductResponseDto,
  SuggestionResponseDto,
} from './dto/product-response.dto';

@ApiTags('products')
@Controller({ path: 'products' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @AdminOnly()
  @Post()
  @ApiOperation({ summary: 'Tạo sản phẩm mới (ADMIN)' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiConflictResponse({ description: 'Slug hoặc SKU sản phẩm đã tồn tại' })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(dto);
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Gợi ý từ khóa tìm kiếm sản phẩm' })
  @ApiResponse({ status: 200, type: SuggestionResponseDto })
  @ApiResponse({ status: 400, description: 'Từ khóa quá ngắn' })
  async suggestions(
    @Query() query: SuggestionQueryDto,
  ): Promise<SuggestionResponseDto> {
    const data = await this.productsService.suggest(query);
    return { data };
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Danh sách sản phẩm nổi bật cho landing' })
  @ApiResponse({ status: 200, type: [FeaturedProductResponseDto] })
  featured(
    @Query() query: FeaturedQueryDto,
  ): Promise<FeaturedProductResponseDto[]> {
    return this.productsService.findFeatured(query);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Tìm kiếm / liệt kê sản phẩm đang hoạt động (phân trang)',
  })
  @ApiResponse({ status: 200, type: PaginatedProductResponseDto })
  findAll(
    @Query() query: QueryProductDto,
  ): Promise<PaginatedProductResponseDto> {
    return this.productsService.findAllActive(query);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Lấy chi tiết sản phẩm theo slug' })
  @ApiParam({ name: 'slug', example: 'ao-thun-nam-basic' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  findBySlug(@Param('slug') slug: string): Promise<ProductResponseDto> {
    return this.productsService.findActiveBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết sản phẩm theo ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'ID không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.findActiveById(id);
  }

  @AdminOnly()
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật sản phẩm (ADMIN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  @ApiConflictResponse({ description: 'Slug hoặc SKU sản phẩm đã tồn tại' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, dto);
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mềm sản phẩm (ADMIN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Đã xóa mềm sản phẩm' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
