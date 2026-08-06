import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, PayOSError } from '@payos/node';
import type { WebhookData } from '@payos/node';
import { PayOsConfig } from '../../config/configuration';
import {
  CreatePaymentLinkParams,
  CreatePaymentLinkResult,
  PaymentGateway,
  PaymentLinkInfo,
} from './payos-gateway.interface';

/**
 * Real PayOS implementation. Never logs `apiKey`/`checksumKey`/`clientId`
 * or the raw SDK response — only provider-safe fields. `isEnabled()` lets
 * callers fail fast with a clear 503 instead of the SDK throwing a
 * confusing auth error when PayOS was never configured for this
 * environment (mirrors GoogleOAuthConfig.isConfigured's pattern).
 */
@Injectable()
export class PayOsGatewayService implements PaymentGateway {
  private readonly logger = new Logger(PayOsGatewayService.name);
  private readonly config: PayOsConfig;
  private client: PayOS | null = null;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.config = configService.get<PayOsConfig>('payos') as PayOsConfig;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private getClient(): PayOS {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'PayOS chưa được cấu hình cho môi trường này',
      });
    }
    if (!this.client) {
      this.client = new PayOS({
        clientId: this.config.clientId,
        apiKey: this.config.apiKey,
        checksumKey: this.config.checksumKey,
        timeout: this.config.requestTimeoutMs,
      });
    }
    return this.client;
  }

  async createPaymentLink(
    params: CreatePaymentLinkParams,
  ): Promise<CreatePaymentLinkResult> {
    try {
      const result = await this.getClient().paymentRequests.create({
        orderCode: params.orderCode,
        amount: params.amount,
        description: params.description,
        returnUrl: this.config.returnUrl,
        cancelUrl: this.config.cancelUrl,
        items: params.items,
      });
      return {
        checkoutUrl: result.checkoutUrl,
        paymentLinkId: result.paymentLinkId,
        status: result.status,
      };
    } catch (error) {
      this.logProviderError('createPaymentLink', error);
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Không thể tạo liên kết thanh toán lúc này',
      });
    }
  }

  async getPaymentLinkInformation(orderCode: number): Promise<PaymentLinkInfo> {
    try {
      const result = await this.getClient().paymentRequests.get(orderCode);
      return {
        paymentLinkId: result.id,
        orderCode: result.orderCode,
        amount: result.amount,
        status: result.status,
      };
    } catch (error) {
      this.logProviderError('getPaymentLinkInformation', error);
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Không thể đồng bộ trạng thái thanh toán lúc này',
      });
    }
  }

  verifyWebhookData(webhook: {
    code: string;
    desc: string;
    success: boolean;
    data: WebhookData;
    signature: string;
  }): Promise<WebhookData> {
    // Deliberately NOT wrapped in try/catch that swallows the error — an
    // invalid signature must propagate so the caller never proceeds to
    // mutate anything. verify() throws WebhookError (from @payos/node).
    return this.getClient().webhooks.verify(webhook);
  }

  /** Never logs the raw error object (may embed request/response detail) —
   * only a safe name + message, never credentials. */
  private logProviderError(operation: string, error: unknown): void {
    const message =
      error instanceof PayOSError ? error.message : 'unknown error';
    this.logger.warn(`PayOS ${operation} failed: ${message}`);
  }
}
