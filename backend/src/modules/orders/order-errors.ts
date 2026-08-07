import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../cart/enums/order-status.enum';

/**
 * Chapter 19 (Order Management) — stable machine-readable error codes for the
 * order state machine. These strings are part of the API contract (the
 * frontend switches on `code`, not on `message`), so treat them as append-only
 * and never rename an existing value.
 */
export const ORDER_ERROR_CODES = {
  NOT_FOUND: 'ORDER_NOT_FOUND',
  ACCESS_DENIED: 'ORDER_ACCESS_DENIED',
  STATUS_INVALID: 'ORDER_STATUS_INVALID',
  TRANSITION_NOT_ALLOWED: 'ORDER_TRANSITION_NOT_ALLOWED',
  ALREADY_CANCELLED: 'ORDER_ALREADY_CANCELLED',
  CANCELLATION_NOT_ALLOWED: 'ORDER_CANCELLATION_NOT_ALLOWED',
  REFUND_REQUIRED: 'ORDER_REFUND_REQUIRED',
  CONCURRENT_MODIFICATION: 'ORDER_CONCURRENT_MODIFICATION',
  FILTER_INVALID: 'ORDER_FILTER_INVALID',
} as const;

/**
 * Deliberately the same 404 for "order does not exist" and "order belongs to
 * another user" — an order id guessed by a non-owner is indistinguishable from
 * a typo, never leaking existence. Matches the AddressesService ownership 404
 * policy (see `AddressesService.notFound`).
 */
export function orderNotFound(): NotFoundException {
  return new NotFoundException({
    code: ORDER_ERROR_CODES.NOT_FOUND,
    message: 'Order not found',
  });
}

export function orderTransitionNotAllowed(
  from: OrderStatus,
  to: OrderStatus,
): ConflictException {
  return new ConflictException({
    code: ORDER_ERROR_CODES.TRANSITION_NOT_ALLOWED,
    message: `Cannot transition order from ${from} to ${to}`,
  });
}

export function orderAlreadyCancelled(): ConflictException {
  return new ConflictException({
    code: ORDER_ERROR_CODES.ALREADY_CANCELLED,
    message: 'Order is already cancelled',
  });
}

export function orderRefundRequired(): ConflictException {
  return new ConflictException({
    code: ORDER_ERROR_CODES.REFUND_REQUIRED,
    message: 'Order is already paid; cancellation requires a refund workflow',
  });
}
