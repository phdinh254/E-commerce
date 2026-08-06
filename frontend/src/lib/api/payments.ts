import { apiClient } from "@/lib/api/client";
import type { PaymentStatusResult } from "@/types/payment";

export const paymentsApi = {
  /** GET /orders/:orderId/payment-status — read-only, ownership-scoped by
   * the backend via the JWT subject. This is the ONLY source of truth for
   * payment/order status — never a redirect query param. */
  async getStatus(orderId: string, signal?: AbortSignal): Promise<PaymentStatusResult> {
    const response = await apiClient.get<PaymentStatusResult>(
      `/orders/${encodeURIComponent(orderId)}/payment-status`,
      { signal },
    );
    return response.data;
  },

  /** POST /payments/:paymentId/sync — backup reconciliation path for when
   * the PayOS webhook hasn't landed yet; rate-limited server-side. */
  async syncStatus(paymentId: string): Promise<PaymentStatusResult> {
    const response = await apiClient.post<PaymentStatusResult>(
      `/payments/${encodeURIComponent(paymentId)}/sync`,
    );
    return response.data;
  },
};
