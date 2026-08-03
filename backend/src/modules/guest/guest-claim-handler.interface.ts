/**
 * Extension point for chapters that add real guest-owned domain data (Cart,
 * etc.). Each registered handler is invoked exactly once, only for the
 * request that wins the idempotent claim (see `GuestClaimsRepository`),
 * before the guest's Redis session is retired. A handler that throws aborts
 * the claim — nothing is marked claimed if a handler fails, so a retry can
 * safely try again.
 *
 * No handlers are registered as of this chapter (no Cart module exists
 * yet). A future module wires one in by re-providing `GUEST_CLAIM_HANDLERS`
 * with its own handler included — see `guest.module.ts`.
 */
export interface GuestClaimHandler {
  claim(params: { guestId: string; userId: string }): Promise<void>;
}

export const GUEST_CLAIM_HANDLERS = 'GUEST_CLAIM_HANDLERS';
