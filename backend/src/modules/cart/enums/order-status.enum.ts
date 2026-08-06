/**
 * Cart-is-order pattern: an Order with status CART is the user's cart.
 * PENDING_PAYMENT/PAID/CANCELLED are reserved for the checkout chapter —
 * Chapter 15 only ever reads/writes CART.
 */
export enum OrderStatus {
  CART = 'CART',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}
