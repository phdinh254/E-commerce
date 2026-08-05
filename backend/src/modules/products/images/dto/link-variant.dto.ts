import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/**
 * `variantId` is required in the body (either a UUID to link, or explicit
 * `null` to unlink) — NOT optional, so an empty `{}` payload is a 400
 * rather than a silently-ambiguous no-op.
 */
export class LinkVariantDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  variantId: string | null;
}
