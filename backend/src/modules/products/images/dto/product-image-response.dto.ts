import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductImageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  variantId: string | null;

  /**
   * Freshly-generated signed URL (bucket is private) — never persisted,
   * never cached beyond `expiresInSeconds`. See Ch11-B99/Ch11-B104.
   */
  @ApiProperty()
  url: string;

  @ApiProperty({
    description: 'Seconds until `url` expires from the moment of this response',
  })
  urlExpiresInSeconds: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiPropertyOptional({ nullable: true })
  altText: string | null;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
