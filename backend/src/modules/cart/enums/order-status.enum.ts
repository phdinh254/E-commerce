/**
 * Cart-is-order pattern: an Order with status CART is the user's cart.
 * PENDING_PAYMENT/PAID/CANCELLED were reserved for the checkout chapter —
 * Chapter 15 only ever read/wrote CART. Chapter 19 (Order Management) adds
 * the post-payment fulfillment statuses: CONFIRMED (admin/ops has accepted
 * the paid order), PROCESSING, SHIPPED, DELIVERED.
 */
export enum OrderStatus {
  CART = 'CART',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}
