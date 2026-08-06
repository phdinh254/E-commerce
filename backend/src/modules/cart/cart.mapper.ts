import { Injectable } from '@nestjs/common';
import { OrderEntity } from './entities/order.entity';
import { CartItemResponseDto, CartResponseDto } from './dto/cart-response.dto';

export interface VariantOptionLabel {
  optionName: string;
  value: string;
}

export const EMPTY_CART: CartResponseDto = {
  cartId: null,
  items: [],
  totalQuantity: 0,
  subtotal: 0,
  currency: 'VND',
  updatedAt: null,
};

@Injectable()
export class CartMapper {
  /**
   * `optionLabelsByVariantId` is pre-fetched in one batched call by the
   * service (ProductVariantsService.findManyByIdsWithOptionValues) — the
   * mapper itself never queries, keeping this a pure, N+1-free projection.
   */
  toResponse(
    order: OrderEntity,
    optionLabelsByVariantId: Map<string, VariantOptionLabel[]>,
  ): CartResponseDto {
    const items: CartItemResponseDto[] = order.items.map((item) => {
      const product = item.product;
      const variant = item.variant;
      const productActive = product.isActive && !product.deletedAt;
      const variantActive = variant ? variant.isActive : true;
      const available = productActive && variantActive;

      let unavailableReason: string | null = null;
      if (!productActive) {
        unavailableReason = 'Sản phẩm không còn hoạt động';
      } else if (!variantActive) {
        unavailableReason = 'Biến thể sản phẩm không còn hoạt động';
      }

      const labels = variant
        ? (optionLabelsByVariantId.get(variant.id) ?? [])
        : [];

      return {
        itemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: product.name,
        slug: product.slug,
        sku: variant?.sku ?? product.sku,
        image: product.thumbnailUrl,
        selectedOptions: labels.length
          ? labels.map((l) => `${l.optionName}: ${l.value}`)
          : null,
        quantity: item.quantity,
        unitPrice: item.unitPriceAmount,
        lineTotal: item.unitPriceAmount * item.quantity,
        available,
        unavailableReason,
      };
    });

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

    return {
      cartId: order.id,
      items,
      totalQuantity,
      subtotal,
      currency: 'VND',
      updatedAt: order.updatedAt,
    };
  }
}
