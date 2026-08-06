/**
 * PAID/CANCELLED/EXPIRED/FAILED are terminal — PaymentTransitionService
 * guards against a terminal state ever being overwritten by a stale or
 * out-of-order callback. Allowed transitions: PENDING -> {PAID, CANCELLED,
 * EXPIRED, FAILED}. A duplicate PENDING -> PAID (already PAID) is a
 * no-op, not an error.
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  PaymentStatus.PAID,
  PaymentStatus.CANCELLED,
  PaymentStatus.EXPIRED,
  PaymentStatus.FAILED,
]);
