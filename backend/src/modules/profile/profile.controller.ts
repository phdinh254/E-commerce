import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../auth/dto/auth-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * GET is deliberately NOT duplicated here — `GET /api/v1/auth/me` already
 * exists, is authenticated, ownership-scoped via the JWT subject, and
 * returns the exact same safe shape (`UserResponseDto`); the frontend's
 * `useProfile()` hook calls it directly. This controller only adds the
 * missing write side.
 */
@ApiTags('profile')
@ApiBearerAuth()
@Controller({ path: 'profile' })
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  @ApiOperation({ summary: 'Cập nhật hồ sơ (chỉ fullName) của user hiện tại' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateProfile(
      user.id,
      dto.fullName,
    );
    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
    };
  }
}
