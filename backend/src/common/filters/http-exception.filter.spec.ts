import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import { GlobalExceptionFilter } from './http-exception.filter';

function makeHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = { method: 'POST', originalUrl: '/api/v1/products/x/images' };
  const response = { status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('GlobalExceptionFilter (Multer errors)', () => {
  it('maps LIMIT_FILE_SIZE to 413', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json, status } = makeHost();
    filter.catch(new MulterError('LIMIT_FILE_SIZE'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.PAYLOAD_TOO_LARGE }),
    );
  });

  it('maps LIMIT_FILE_COUNT to 400', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status } = makeHost();
    filter.catch(new MulterError('LIMIT_FILE_COUNT'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps LIMIT_UNEXPECTED_FILE to 400', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status } = makeHost();
    filter.catch(new MulterError('LIMIT_UNEXPECTED_FILE'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('does not leak a raw stack trace for a Multer error', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json } = makeHost();
    filter.catch(new MulterError('LIMIT_FILE_SIZE'), host);
    const [[rawBody]] = json.mock.calls as [[{ message: string }]];
    const body = rawBody;
    expect(body.message).not.toContain('at ');
    expect(JSON.stringify(body)).not.toMatch(/\.ts:\d+/);
  });
});
