import { Injectable } from '@nestjs/common';

/**
 * Minimal clock abstraction — nothing in the codebase called `new Date()`
 * directly inside business logic before this, but Coupon validity-window
 * boundary tests (startsAt/endsAt) need a controllable "now" instead of the
 * real system clock. Inject this instead of calling `new Date()` inline;
 * tests substitute a mock with a fixed `now()`.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
