import { PaymentLinkStatus, WebhookData } from '@payos/node';

/** Provider-agnostic abstraction — Checkout/PaymentsService never call the
 * PayOS SDK directly, only this interface. Keeps provider-specific DTOs at
 * the boundary (this file + payos-gateway.service.ts), never leaking a raw
 * SDK type into the rest of the domain. */
export interface CreatePaymentLinkParams {
  orderCode: number;
  amount: number;
  description: string;
  items: { name: string; quantity: number; price: number }[];
}

export interface CreatePaymentLinkResult {
  checkoutUrl: string;
  paymentLinkId: string;
  status: PaymentLinkStatus;
}

export interface PaymentLinkInfo {
  paymentLinkId: string;
  orderCode: number;
  amount: number;
  status: PaymentLinkStatus;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/**
 * Property-typed function members (not method shorthand) — deliberately,
 * so `jest.Mocked<PaymentGateway>` mocks in tests can be referenced as
 * bare values (`expect(gateway.createPaymentLink).toHaveBeenCalledWith(...)`)
 * without tripping `@typescript-eslint/unbound-method`. Class implementations
 * (PayOsGatewayService, FakePayOsGateway) still satisfy this structurally
 * using ordinary method syntax.
 */
export interface PaymentGateway {
  createPaymentLink: (
    params: CreatePaymentLinkParams,
  ) => Promise<CreatePaymentLinkResult>;
  getPaymentLinkInformation: (orderCode: number) => Promise<PaymentLinkInfo>;
  /** Throws when the signature is missing/invalid/data-tampered — callers
   * must never mutate anything before this resolves successfully. */
  verifyWebhookData: (webhook: {
    code: string;
    desc: string;
    success: boolean;
    data: WebhookData;
    signature: string;
  }) => Promise<WebhookData>;
}
