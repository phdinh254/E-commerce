import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../cart.constants';

/** Absolute-value semantics: sets quantity to exactly this number, not a delta. */
export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, maximum: MAX_CART_ITEM_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number;
}
