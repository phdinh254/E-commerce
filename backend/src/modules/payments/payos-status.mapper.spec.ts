import type { PaymentLinkStatus, WebhookData } from '@payos/node';
import {
  mapPaymentLinkStatus,
  mapWebhookDataStatus,
} from './payos-status.mapper';
import { PaymentStatus } from './enums/payment-status.enum';

function buildWebhookData(overrides: Partial<WebhookData> = {}): WebhookData {
  return {
    orderCode: 100000001,
    amount: 100_000,
    description: 'test',
    accountNumber: '0123456789',
    reference: 'ref-1',
    transactionDateTime: new Date().toISOString(),
    currency: 'VND',
    paymentLinkId: 'link-1',
    code: '00',
    desc: 'success',
    ...overrides,
  };
}

describe('mapPaymentLinkStatus', () => {
  it.each<[PaymentLinkStatus, PaymentStatus]>([
    ['PAID', PaymentStatus.PAID],
    ['CANCELLED', PaymentStatus.CANCELLED],
    ['EXPIRED', PaymentStatus.EXPIRED],
    ['FAILED', PaymentStatus.FAILED],
    ['PENDING', PaymentStatus.PENDING],
    ['PROCESSING', PaymentStatus.PENDING],
    ['UNDERPAID', PaymentStatus.PENDING],
  ])('maps PayOS %s to %s', (input, expected) => {
    expect(mapPaymentLinkStatus(input)).toBe(expected);
  });
});

describe('mapWebhookDataStatus', () => {
  it('maps code=00 to PAID', () => {
    expect(mapWebhookDataStatus(buildWebhookData({ code: '00' }))).toBe(
      PaymentStatus.PAID,
    );
  });

  it('maps any non-00 code to FAILED', () => {
    expect(mapWebhookDataStatus(buildWebhookData({ code: '01' }))).toBe(
      PaymentStatus.FAILED,
    );
  });
});
