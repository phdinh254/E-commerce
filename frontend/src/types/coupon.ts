// Real backend contract types for Chapter 16 (Coupon). Mirrors, field-for-
// field, backend/src/modules/coupons/dto/*.ts — no invented fields.

export type CouponDiscountType = "PERCENTAGE" | "FIXED";

export type CouponReasonCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_INACTIVE"
  | "COUPON_NOT_STARTED"
  | "COUPON_EXPIRED"
  | "COUPON_USAGE_LIMIT_REACHED"
  | "COUPON_MINIMUM_NOT_MET"
  | "COUPON_INVALID_VALUE";

export interface CouponPreviewResult {
  code: string;
  valid: boolean;
  discountType: CouponDiscountType | null;
  discountValue: number | null;
  subtotal: number;
  discountAmount: number;
  total: number;
  reasonCode: CouponReasonCode | null;
  message: string;
}

export interface FeaturedCoupon {
  code: string;
  name: string | null;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startsAt: string;
  endsAt: string;
}
