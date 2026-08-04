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
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdminOnly } from '../guest/decorators/admin-only.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import {
  CategoryResponseDto,
  PaginatedCategoryResponseDto,
} from './dto/category-response.dto';

@ApiTags('categories')
@Controller({ path: 'categories' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @AdminOnly()
  @Post()
  @ApiOperation({ summary: 'Tạo danh mục mới (ADMIN)' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiConflictResponse({ description: 'Slug danh mục đã tồn tại' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách danh mục đang hoạt động (phân trang)',
  })
  @ApiResponse({ status: 200, type: PaginatedCategoryResponseDto })
  findAll(
    @Query() query: QueryCategoryDto,
  ): Promise<PaginatedCategoryResponseDto> {
    return this.categoriesService.findAllActive(query);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Lấy chi tiết danh mục theo slug' })
  @ApiParam({ name: 'slug', example: 'dien-thoai' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục' })
  findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findActiveBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết danh mục theo ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: 'ID không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findActiveById(id);
  }

  @AdminOnly()
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật danh mục (ADMIN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục' })
  @ApiConflictResponse({ description: 'Slug danh mục đã tồn tại' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, dto);
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mềm danh mục (ADMIN)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Đã xóa mềm danh mục' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục' })
  @ApiConflictResponse({ description: 'Danh mục còn danh mục con' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
