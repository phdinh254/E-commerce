import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Multipart text fields alongside the binary `file` part. `file` itself is
 * NOT a property here — it is bound via `@UploadedFile()` off the
 * FileInterceptor, not through class-validator/whitelist. Everything a
 * client must not be able to set (productId, storageBucket, objectPath,
 * mimeType, sizeBytes, createdBy) is deliberately absent — the global
 * `forbidNonWhitelisted` ValidationPipe rejects any of those if sent.
 */
export class CreateProductImageDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'Mặt trước sản phẩm' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  altText?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  displayOrder?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  variantId?: string;
}
