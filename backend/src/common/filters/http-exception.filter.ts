import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
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
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
};

/**
 * Multer throws its own `MulterError` (not an `HttpException`) directly out
 * of the interceptor, before any controller/service code runs — so this is
 * the only place that can turn "file too large" / "too many files" into the
 * status codes Ch11-B100/B102 require, instead of falling through to a
 * generic 500.
 */
const MULTER_ERROR_STATUS: Partial<Record<string, HttpStatus>> = {
  LIMIT_FILE_SIZE: HttpStatus.PAYLOAD_TOO_LARGE,
  LIMIT_FILE_COUNT: HttpStatus.BAD_REQUEST,
  LIMIT_UNEXPECTED_FILE: HttpStatus.BAD_REQUEST,
  LIMIT_PART_COUNT: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_COUNT: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_KEY: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_VALUE: HttpStatus.BAD_REQUEST,
};

const MULTER_ERROR_MESSAGE: Partial<Record<string, string>> = {
  LIMIT_FILE_SIZE: 'File vượt quá kích thước tối đa cho phép',
  LIMIT_FILE_COUNT: 'Vượt quá số lượng file cho phép trong một lần upload',
  LIMIT_UNEXPECTED_FILE: 'Field upload không hợp lệ',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const isMulterError = exception instanceof MulterError;
    const statusCode = isHttpException
      ? exception.getStatus()
      : isMulterError
        ? (MULTER_ERROR_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST)
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Đã xảy ra lỗi không xác định';
    let code = DEFAULT_ERROR_CODE;
    let details: unknown[] = [];

    if (isMulterError) {
      message = MULTER_ERROR_MESSAGE[exception.code] ?? exception.message;
      code = exception.code;
    } else if (isHttpException) {
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

    if (!isHttpException && !isMulterError) {
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
