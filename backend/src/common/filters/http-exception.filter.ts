import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

interface HttpExceptionBody {
  message?: string | string[];
  code?: string;
  error?: string;
}

const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Đã xảy ra lỗi không xác định';
    let code = DEFAULT_ERROR_CODE;
    let details: unknown[] = [];

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const typedBody = body as HttpExceptionBody;
        if (Array.isArray(typedBody.message)) {
          message = typedBody.message[0] ?? message;
          details = typedBody.message;
        } else if (typedBody.message) {
          message = typedBody.message;
        }
        code =
          typedBody.code ?? STATUS_CODE_MAP[statusCode] ?? DEFAULT_ERROR_CODE;
      }
      if (code === DEFAULT_ERROR_CODE) {
        code = STATUS_CODE_MAP[statusCode] ?? DEFAULT_ERROR_CODE;
      }
    }

    const requestId = request.requestId ?? 'unknown';

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorResponse: ErrorResponseDto = {
      statusCode,
      code,
      message,
      details,
      path: request.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(errorResponse);
  }
}
