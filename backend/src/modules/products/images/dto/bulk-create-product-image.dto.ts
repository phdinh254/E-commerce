import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Deliberately does NOT accept a per-file altText[]/displayOrder[] array.
 * The course material does not mandate per-file metadata for bulk upload,
 * and an array-keyed-by-position contract is exactly the ambiguous design
 * the task brief warns against (what happens when the array length
 * doesn't match `files.length`?). Per-image metadata (altText,
 * displayOrder) is set afterwards via `PATCH .../images/:imageId` — see
 * Ch11-B104. All images in one bulk request optionally share one
 * `variantId` link.
 */
export class BulkCreateProductImageDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  variantId?: string;
}
