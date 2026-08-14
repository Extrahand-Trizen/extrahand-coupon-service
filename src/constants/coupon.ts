export const DISCOUNT_TYPES = ['FIXED', 'PERCENTAGE'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const APPLICABILITY_TYPES = ['ALL_SERVICES', 'SELECTED_SERVICES'] as const;
export type ApplicabilityType = (typeof APPLICABILITY_TYPES)[number];

export const FLOW_TYPES = ['BOOK_NOW', 'POST_COMPARE'] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

export const COUPON_REDEMPTION_SCOPES = ['PER_USER', 'GLOBAL_SINGLE_USE'] as const;
export type CouponRedemptionScope = (typeof COUPON_REDEMPTION_SCOPES)[number];

export const REDEMPTION_STATUSES = ['PENDING', 'REDEEMED', 'CANCELLED', 'EXPIRED'] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

export const COUPON_ERROR_CODES = {
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_INACTIVE: 'COUPON_INACTIVE',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_NOT_STARTED: 'COUPON_NOT_STARTED',
  COUPON_NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
  SERVICE_NOT_ELIGIBLE: 'SERVICE_NOT_ELIGIBLE',
  FLOW_NOT_ELIGIBLE: 'FLOW_NOT_ELIGIBLE',
  MINIMUM_ORDER_NOT_MET: 'MINIMUM_ORDER_NOT_MET',
  COUPON_ALREADY_USED: 'COUPON_ALREADY_USED',
  NOT_ELIGIBLE_FOR_FIRST_BOOKING: 'NOT_ELIGIBLE_FOR_FIRST_BOOKING',
  COUPON_REDEMPTION_CONFLICT: 'COUPON_REDEMPTION_CONFLICT',
  COUPON_USAGE_LIMIT_REACHED: 'COUPON_USAGE_LIMIT_REACHED',
  INVALID_REQUEST: 'INVALID_REQUEST',
} as const;

export type CouponErrorCode = (typeof COUPON_ERROR_CODES)[keyof typeof COUPON_ERROR_CODES];

export const COUPON_ERROR_MESSAGES: Record<CouponErrorCode, string> = {
  COUPON_NOT_FOUND: 'This coupon code is not valid.',
  COUPON_INACTIVE: 'This coupon is no longer active.',
  COUPON_EXPIRED: 'This coupon has expired.',
  COUPON_NOT_STARTED: 'This coupon is not available yet.',
  COUPON_NOT_APPLICABLE: 'This coupon cannot be applied to this order.',
  SERVICE_NOT_ELIGIBLE: 'This coupon is not valid for the selected service.',
  FLOW_NOT_ELIGIBLE: 'This coupon cannot be used for this type of booking.',
  MINIMUM_ORDER_NOT_MET: 'Your order amount is too low to use this coupon.',
  COUPON_ALREADY_USED: 'This coupon has already been used.',
  NOT_ELIGIBLE_FOR_FIRST_BOOKING: 'This coupon is available only for first-time bookings.',
  COUPON_REDEMPTION_CONFLICT: 'This coupon is already being used on another payment. Please try again shortly.',
  COUPON_USAGE_LIMIT_REACHED: 'You have reached the usage limit for this coupon.',
  INVALID_REQUEST: 'Invalid coupon request.',
};

export function normalizeCouponCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
