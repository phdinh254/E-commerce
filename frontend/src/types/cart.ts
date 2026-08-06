// Real backend contract types for Chapter 15 (cart-is-order). Mirrors,
// field-for-field, backend/src/modules/cart/dto/cart-response.dto.ts — no
// invented fields, no client-side price/name source of truth.

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
  subtotal: number;
  currency: "VND";
  updatedAt: string | null;
}

export interface AddCartItemPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}
