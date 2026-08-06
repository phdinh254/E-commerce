import { apiClient } from "@/lib/api/client";
import type { CheckoutPayload, CheckoutResult } from "@/types/payment";

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

export const checkoutApi = {
  /**
   * POST /checkout/cod — payload is shipping fields only, never
   * price/subtotal/discount/total/userId/paymentStatus (the backend
   * recomputes and freezes those server-side). `idempotencyKey` must be
   * generated once per checkout intent and reused verbatim on any retry.
   */
  async placeCod(payload: CheckoutPayload, idempotencyKey: string): Promise<CheckoutResult> {
    const response = await apiClient.post<CheckoutResult>("/checkout/cod", payload, {
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    });
    return response.data;
  },

  /** POST /checkout/payos — same contract as placeCod; `checkoutUrl` in the
   * response is the PayOS-hosted page to redirect the user to. */
  async placePayOs(payload: CheckoutPayload, idempotencyKey: string): Promise<CheckoutResult> {
    const response = await apiClient.post<CheckoutResult>("/checkout/payos", payload, {
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    });
    return response.data;
  },
};
