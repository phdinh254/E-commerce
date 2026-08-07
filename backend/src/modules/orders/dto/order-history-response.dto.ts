import { OrderStatus } from '../../cart/enums/order-status.enum';

/**
 * Customer-facing order history entry. Deliberately omits `actorId` and
 * `fromStatus` — an internal Admin UUID/email (or the admin identity
 * implied by knowing who changed what) must never leak to the customer
 * response. See OrderHistoryService.listCustomerSafe for the full mapping
 * rationale.
 */
export class OrderHistoryEntryDto {
  toStatus: OrderStatus;
  createdAt: Date;
  reason: string | null;
}
