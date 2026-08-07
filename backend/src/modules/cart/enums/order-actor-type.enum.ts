/**
 * Chapter 19 (Order Management) — who initiated an order status transition.
 * Recorded alongside `actorId` on OrderStatusHistoryEntity so history rows
 * can distinguish a customer-initiated action, an admin/ops action, and a
 * system-initiated transition (e.g. payment webhook, automated cutoff) from
 * one another.
 */
export enum OrderActorType {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}
