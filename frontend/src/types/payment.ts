// Mirrors, field-for-field, backend/src/modules/payments/dto/*.dto.ts and
// backend/src/modules/payments/enums/*.enum.ts — no invented fields, no
// client-side price/status source of truth. amount/paymentStatus/orderStatus
// always come from the backend, never computed or guessed on the client.

export type PaymentMethod = "COD" | "PAYOS";

export type PaymentStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";

export type OrderStatus = "CART" | "PENDING_PAYMENT" | "PAID" | "CANCELLED";

/** PAID/CANCELLED/EXPIRED/FAILED — mirrors TERMINAL_PAYMENT_STATUSES on the
 * backend. Used by callers that need to duplicate the terminal check
 * client-side (e.g. deciding whether to keep polling) without waiting for
 * the next `isTerminal` response field. */
export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  "PAID",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
]);

/**
 * Ch18: `addressId` must reference a saved Address owned by the
 * authenticated user — the backend resolves and ownership-checks it
 * server-side (see CheckoutService), never trusting a client-supplied
 * recipient/phone/street. `shippingNote` is a per-order instruction,
 * independent of the saved Address's own `label`.
 */
export interface CheckoutPayload {
  addressId: string;
  shippingNote?: string;
}

export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Non-null only for PAYOS while still PENDING. */
  checkoutUrl: string | null;
}

export interface PaymentStatusResult {
  orderId: string;
  paymentId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  /** Integer VND. */
  amount: number;
  currency: string;
  paidAt: string | null;
  isTerminal: boolean;
  checkoutUrl: string | null;
}
