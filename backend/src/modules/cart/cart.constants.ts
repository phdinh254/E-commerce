/**
 * Inventory (Inventory chapter) does not exist yet — this is a centralized
 * business-rule cap on cart-line quantity, not a stand-in for real stock
 * availability. Real inventory checking happens against
 * ProductVariantEntity.stock, which already exists and is reused as-is.
 */
export const MAX_CART_ITEM_QUANTITY = 999;

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export const CART_ADD_ITEM_OPERATION = 'cart.add_item';
