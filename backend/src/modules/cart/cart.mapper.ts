import { Injectable } from '@nestjs/common';
import { OrderEntity } from './entities/order.entity';
import { CartItemResponseDto, CartResponseDto } from './dto/cart-response.dto';

export interface VariantOptionLabel {
  optionName: string;
  value: string;
}

/** Shape produced by CartPricingService.revalidateCoupon — declared locally
 * (not imported) so this pure mapper stays decoupled from the pricing
 * orchestration service. */
export interface CouponPricingInput {
  discountAmount: number;
  couponRemoved: boolean;
  removedReason: string | null;
}

const NO_COUPON: CouponPricingInput = {
  discountAmount: 0,
  couponRemoved: false,
  removedReason: null,
};

export const EMPTY_CART: CartResponseDto = {
  cartId: null,
  items: [],
  totalQuantity: 0,
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  appliedCoupon: null,
  couponRemovedReason: null,
  currency: 'VND',
  updatedAt: null,
};

@Injectable()
export class CartMapper {
  /**
   * `optionLabelsByVariantId` is pre-fetched in one batched call by the
   * service (ProductVariantsService.findManyByIdsWithOptionValues) — the
   * mapper itself never queries, keeping this a pure, N+1-free projection.
   *
   * `pricing` is the already-revalidated result from CartPricingService —
   * this mapper never re-derives the discount formula itself, it only
   * projects the given numbers. Defaults to "no coupon" for call sites
   * that don't apply (there are none in practice; every real CartService
   * entrypoint revalidates before mapping).
   */
  toResponse(
    order: OrderEntity,
    optionLabelsByVariantId: Map<string, VariantOptionLabel[]>,
    pricing: CouponPricingInput = NO_COUPON,
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

    const hasCoupon = Boolean(order.couponId) && !pricing.couponRemoved;
    const appliedCoupon = hasCoupon
      ? {
          code: order.couponCodeSnapshot as string,
          name: order.couponNameSnapshot,
          discountType: order.couponDiscountTypeSnapshot!,
          discountValue: order.couponDiscountValueSnapshot as number,
        }
      : null;

    return {
      cartId: order.id,
      items,
      totalQuantity,
      subtotal,
      discountAmount: pricing.discountAmount,
      total: subtotal - pricing.discountAmount,
      appliedCoupon,
      couponRemovedReason: pricing.removedReason,
      currency: 'VND',
      updatedAt: order.updatedAt,
    };
  }
}
