export class ErrorResponseDto {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  path: string;
  requestId: string;
  timestamp: string;
}
