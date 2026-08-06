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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponseDto } from './dto/address-response.dto';

/**
 * Bare authenticated controller — no @Public()/@Roles(), same convention as
 * CartController/CheckoutController. Every route resolves the owner from
 * @CurrentUser() (the verified JWT subject); addressId in the path is only
 * ever used together with that owner, never alone, so cross-user access
 * surfaces as 404 (see AddressesService.notFound), never a raw record.
 */
@ApiTags('addresses')
@ApiBearerAuth()
@Controller({ path: 'profile/addresses' })
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách địa chỉ của user hiện tại' })
  @ApiResponse({ status: 200, type: [AddressResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<AddressResponseDto[]> {
    return this.addressesService.listForUser(user.id);
  }

  @Get(':addressId')
  @ApiOperation({ summary: 'Chi tiết một địa chỉ thuộc user hiện tại' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy hoặc không thuộc user',
  })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<AddressResponseDto> {
    return this.addressesService.getOwnedOrThrow(user.id, addressId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm địa chỉ mới cho user hiện tại' })
  @ApiResponse({ status: 201, type: AddressResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.create(user.id, dto);
  }

  @Patch(':addressId')
  @ApiOperation({ summary: 'Cập nhật một địa chỉ thuộc user hiện tại' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy hoặc không thuộc user',
  })
  @ApiResponse({
    status: 400,
    description:
      'isDefault=false bị từ chối — dùng endpoint /default trên địa chỉ khác',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.update(user.id, addressId, dto);
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Xóa (soft delete) một địa chỉ — tự động promote địa chỉ khác làm mặc định nếu cần',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy hoặc không thuộc user',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<void> {
    return this.addressesService.delete(user.id, addressId);
  }

  @Patch(':addressId/default')
  @ApiOperation({ summary: 'Đặt một địa chỉ làm mặc định — idempotent' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy hoặc không thuộc user',
  })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<AddressResponseDto> {
    return this.addressesService.setDefault(user.id, addressId);
  }
}
