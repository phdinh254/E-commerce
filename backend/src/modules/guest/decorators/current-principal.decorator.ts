import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestPrincipal } from '../interfaces/request-principal.interface';

/**
 * Only meaningful on `@AllowGuest()` (or otherwise principal-resolving)
 * routes — `undefined` on `@Public()` routes, which never resolve an
 * identity. Handlers that require a principal should be behind a guard
 * that guarantees one, not rely on this decorator to enforce it.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.principal;
  },
);
