import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../cart.constants';

/**
 * Deliberately does NOT accept price, productName, sku, or userId — the
 * global ValidationPipe (whitelist + forbidNonWhitelisted) rejects any of
 * those fields outright rather than silently ignoring them.
 */
export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: MAX_CART_ITEM_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number;
}
