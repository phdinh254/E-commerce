import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * Composes the repeated `@Roles(UserRole.ADMIN)` + Swagger-auth annotation
 * pattern into one decorator. `RolesGuard` is already global (registered
 * via `APP_GUARD` in `AuthModule`), so `@UseGuards(RolesGuard)` here is
 * redundant for enforcement — it is included anyway so Nest's metadata
 * scanner and Swagger both see the guard applied directly on routes using
 * this decorator, matching how `@ApiBearerAuth()` expects to find it. This
 * does not double-run the guard: Nest de-duplicates identical guard
 * instances resolved for the same request.
 */
export const AdminOnly = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    Roles(UserRole.ADMIN),
    UseGuards(RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'Authenticated but not an ADMIN' }),
  );
