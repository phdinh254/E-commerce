import { ApiProperty } from '@nestjs/swagger';
import { VariantChangeType } from '../enums/variant-change-type.enum';

export class VariantAuditLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: VariantChangeType })
  changeType: VariantChangeType;

  @ApiProperty()
  oldValue: number;

  @ApiProperty()
  newValue: number;

  @ApiProperty()
  delta: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  actorUserId: string;

  @ApiProperty()
  mutationId: string;

  @ApiProperty()
  createdAt: Date;
}

export class AuditPaginationMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedVariantAuditLogResponseDto {
  @ApiProperty({ type: [VariantAuditLogResponseDto] })
  items: VariantAuditLogResponseDto[];

  @ApiProperty({ type: AuditPaginationMetaDto })
  meta: AuditPaginationMetaDto;
}
