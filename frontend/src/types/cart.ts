// Real backend contract types for Chapter 15/16 (cart-is-order + coupon).
// Mirrors, field-for-field, backend/src/modules/cart/dto/cart-response.dto.ts
// — no invented fields, no client-side price/discount source of truth.

import type { CouponDiscountType } from "./coupon";

export interface AppliedCoupon {
  code: string;
  name: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
}

export interface CartItem {
  itemId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  slug: string;
  sku: string;
  image: string | null;
  selectedOptions: string[] | null;
  quantity: number;
  /** Integer VND — backend-resolved, never client-supplied. */
  unitPrice: number;
  /** unitPrice * quantity, computed by the backend. */
  lineTotal: number;
  available: boolean;
  unavailableReason: string | null;
}

export interface Cart {
  cartId: string | null;
  items: CartItem[];
  /** Sum of item quantities across all lines, not the number of lines. */
  totalQuantity: number;
  /** Tổng tiền các dòng trước giảm giá. */
  subtotal: number;
  /** Số tiền được giảm thực tế, do backend tính. */
  discountAmount: number;
  /** subtotal - discountAmount, do backend tính. */
  total: number;
  appliedCoupon: AppliedCoupon | null;
  /** Chỉ có giá trị trong response của lệnh gọi vừa khiến Coupon tự bị gỡ. */
  couponRemovedReason: string | null;
  currency: "VND";
  updatedAt: string | null;
}

export interface AddCartItemPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}
