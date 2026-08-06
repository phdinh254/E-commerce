import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Allowlist of exactly one field — mass assignment is impossible by
 * construction (ValidationPipe's forbidNonWhitelisted rejects anything
 * else). email/role/status/passwordHash are never accepted here: email has
 * no verified change-email flow yet, role/status are account-admin
 * concerns, passwordHash belongs to the password-reset flow.
 */
export class UpdateProfileDto {
  @ApiProperty({ example: 'Nguyen Van A', minLength: 2, maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;
}
