import type { PaymentLinkStatus, WebhookData } from '@payos/node';
import { PaymentStatus } from './enums/payment-status.enum';

/**
 * Used by the SYNC path (`payos.paymentRequests.get` result). PROCESSING and
 * UNDERPAID are not yet a final outcome — both map to PENDING so the
 * transition guard leaves the Payment untouched until PayOS reaches a
 * definitive state.
 */
export function mapPaymentLinkStatus(status: PaymentLinkStatus): PaymentStatus {
  switch (status) {
    case 'PAID':
      return PaymentStatus.PAID;
    case 'CANCELLED':
      return PaymentStatus.CANCELLED;
    case 'EXPIRED':
      return PaymentStatus.EXPIRED;
    case 'FAILED':
      return PaymentStatus.FAILED;
    case 'PENDING':
    case 'PROCESSING':
    case 'UNDERPAID':
    default:
      return PaymentStatus.PENDING;
  }
}

/**
 * Used by the WEBHOOK path. PayOS only ever calls the webhook for a
 * completed/successful transaction (`data.code === '00'`) — there is no
 * push notification for cancel/expire, those are only observable via sync.
 * Any other code on an actually-delivered webhook is treated as FAILED
 * rather than silently ignored, since PayOS did notify us of *something*.
 */
export function mapWebhookDataStatus(data: WebhookData): PaymentStatus {
  return data.code === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED;
}
