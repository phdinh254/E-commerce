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
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
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
import { ProductImagesService } from './product-images.service';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { BulkCreateProductImageDto } from './dto/bulk-create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { LinkVariantDto } from './dto/link-variant.dto';
import { ListProductImagesQueryDto } from './dto/list-product-images-query.dto';
import { ProductImageResponseDto } from './dto/product-image-response.dto';
import {
  bulkImageUploadOptions,
  singleImageUploadOptions,
} from './multer.config';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_BULK_UPLOAD,
} from './upload-validation.constants';

const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);

@ApiTags('product-images')
@Controller({ path: 'products/:productId/images' })
export class ProductImagesController {
  constructor(private readonly imagesService: ProductImagesService) {}

  @AdminOnly()
  @Post('bulk')
  @UseInterceptors(
    FilesInterceptor(
      'files',
      MAX_IMAGES_PER_BULK_UPLOAD,
      bulkImageUploadOptions,
    ),
  )
  @ApiOperation({
    summary: `Upload nhiều ảnh cùng lúc (ADMIN) — tối đa ${MAX_IMAGES_PER_BULK_UPLOAD} file, mỗi file tối đa ${MAX_IMAGE_SIZE_MB}MB, all-or-nothing`,
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        variantId: { type: 'string', format: 'uuid' },
      },
      required: ['files'],
    },
  })
  @ApiResponse({ status: 201, type: [ProductImageResponseDto] })
  @ApiResponse({ status: 400, description: 'File không hợp lệ hoặc thiếu' })
  @ApiResponse({
    status: 413,
    description: 'File vượt quá kích thước cho phép',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm hoặc biến thể' })
  @ApiResponse({
    status: 503,
    description: 'Dịch vụ lưu trữ ảnh không khả dụng',
  })
  uploadBulk(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: BulkCreateProductImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductImageResponseDto[]> {
    return this.imagesService.uploadBulk(productId, user.id, files, dto);
  }

  @AdminOnly()
  @Get('admin')
  @ApiOperation({
    summary:
      'Danh sách toàn bộ ảnh còn tồn tại của sản phẩm, kể cả ảnh của Product/Variant inactive (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ProductImageResponseDto] })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm' })
  listForAdmin(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductImageResponseDto[]> {
    return this.imagesService.listForAdmin(productId);
  }

  @AdminOnly()
  @Post()
  @UseInterceptors(FileInterceptor('file', singleImageUploadOptions))
  @ApiOperation({
    summary: `Upload một ảnh (ADMIN) — chỉ ${ALLOWED_IMAGE_MIME_TYPES.join('/')}, tối đa ${MAX_IMAGE_SIZE_MB}MB`,
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string' },
        displayOrder: { type: 'integer' },
        variantId: { type: 'string', format: 'uuid' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, type: ProductImageResponseDto })
  @ApiResponse({
    status: 400,
    description: 'File thiếu, rỗng, hoặc không đúng định dạng',
  })
  @ApiResponse({
    status: 413,
    description: 'File vượt quá kích thước cho phép',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm hoặc biến thể' })
  @ApiResponse({
    status: 503,
    description: 'Dịch vụ lưu trữ ảnh không khả dụng',
  })
  uploadSingle(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateProductImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductImageResponseDto> {
    return this.imagesService.uploadSingle(productId, user.id, file, dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Danh sách ảnh công khai của sản phẩm (ảnh Product-level, cộng ảnh của một Variant nếu truyền variantId)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ProductImageResponseDto] })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm hoặc biến thể' })
  listPublic(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListProductImagesQueryDto,
  ): Promise<ProductImageResponseDto[]> {
    return this.imagesService.listPublic(productId, query.variantId);
  }

  @AdminOnly()
  @Patch(':imageId')
  @ApiOperation({ summary: 'Cập nhật altText/displayOrder của ảnh (ADMIN)' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'imageId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductImageResponseDto })
  @ApiResponse({ status: 400, description: 'Payload rỗng hoặc không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy ảnh của sản phẩm này' })
  updateMetadata(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    return this.imagesService.updateMetadata(productId, imageId, dto);
  }

  @AdminOnly()
  @Patch(':imageId/variant')
  @ApiOperation({
    summary:
      'Liên kết hoặc gỡ liên kết ảnh với một Variant của cùng sản phẩm (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'imageId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductImageResponseDto })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy ảnh hoặc biến thể của sản phẩm này',
  })
  linkVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: LinkVariantDto,
  ): Promise<ProductImageResponseDto> {
    return this.imagesService.linkVariant(productId, imageId, dto);
  }

  @AdminOnly()
  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Xóa ảnh (soft-delete bản ghi + yêu cầu xóa object Storage) (ADMIN)',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'imageId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Đã xóa ảnh' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy ảnh của sản phẩm này' })
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.imagesService.remove(productId, imageId);
  }
}
