import { Injectable } from '@nestjs/common';
import type { WebhookData } from '@payos/node';
import {
  CreatePaymentLinkParams,
  CreatePaymentLinkResult,
  PaymentGateway,
  PaymentLinkInfo,
} from './payos-gateway.interface';

/**
 * In-memory fake — used by unit/e2e tests instead of the real PayOS SDK.
 * Deterministic: `createPaymentLink` always succeeds unless
 * `failNextCreate` is set, letting tests exercise the failure path without
 * any network dependency. `verifyWebhookData` mirrors the real SDK's
 * throw-on-invalid-signature contract via `shouldRejectSignature`.
 */
@Injectable()
export class FakePayOsGateway implements PaymentGateway {
  failNextCreate = false;
  shouldRejectSignature = false;
  private readonly links = new Map<number, PaymentLinkInfo>();

  createPaymentLink(
    params: CreatePaymentLinkParams,
  ): Promise<CreatePaymentLinkResult> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return Promise.reject(
        new Error('fake gateway: simulated createPaymentLink failure'),
      );
    }
    const paymentLinkId = `fake-link-${params.orderCode}`;
    this.links.set(params.orderCode, {
      paymentLinkId,
      orderCode: params.orderCode,
      amount: params.amount,
      status: 'PENDING',
    });
    return Promise.resolve({
      checkoutUrl: `https://fake-payos.test/checkout/${params.orderCode}`,
      paymentLinkId,
      status: 'PENDING',
    });
  }

  getPaymentLinkInformation(orderCode: number): Promise<PaymentLinkInfo> {
    const info = this.links.get(orderCode);
    if (!info) {
      return Promise.reject(
        new Error(`fake gateway: no such orderCode ${orderCode}`),
      );
    }
    return Promise.resolve(info);
  }

  verifyWebhookData(webhook: {
    data: WebhookData;
    signature: string;
  }): Promise<WebhookData> {
    if (this.shouldRejectSignature || !webhook.signature) {
      return Promise.reject(new Error('fake gateway: invalid signature'));
    }
    return Promise.resolve(webhook.data);
  }

  /** Test helper — simulate the provider's own status changing (e.g. via
   * the dashboard) ahead of a sync call. */
  setStatus(orderCode: number, status: PaymentLinkInfo['status']): void {
    const info = this.links.get(orderCode);
    if (info) info.status = status;
  }
}
