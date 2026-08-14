import mongoose from 'mongoose';
import Coupon, { ICoupon } from '../models/Coupon';
import CouponRedemption, { ICouponRedemption } from '../models/CouponRedemption';
import { PaymentServiceClient } from '../clients/PaymentServiceClient';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { validateEnv } from '../config/env';
import logger from '../config/logger';
import {
  APPLICABILITY_TYPES,
  ApplicabilityType,
  COUPON_REDEMPTION_SCOPES,
  COUPON_ERROR_CODES,
  COUPON_ERROR_MESSAGES,
  CouponRedemptionScope,
  CouponErrorCode,
  DISCOUNT_TYPES,
  DiscountType,
  FLOW_TYPES,
  FlowType,
  normalizeCouponCode,
  round2,
} from '../constants/coupon';

export type ValidationFailure = {
  valid: false;
  code: CouponErrorCode;
  message: string;
};

export type ValidationSuccess = {
  valid: true;
  couponId: string;
  couponCode: string;
  redemptionScope: CouponRedemptionScope;
  discountType: DiscountType;
  discountAmount: number;
  /** Full cart / order amount before coupon. */
  originalAmount: number;
  amountAfterCoupon: number;
  /** Amount the discount was calculated on (eligible services only when scoped). */
  eligibleAmount: number;
  eligibleServiceIds: string[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export type CouponLineItemInput = {
  serviceId: string;
  amount: number;
};

function fail(code: CouponErrorCode, messageOverride?: string): ValidationFailure {
  return {
    valid: false,
    code,
    message: messageOverride || COUPON_ERROR_MESSAGES[code],
  };
}

function calculateDiscount(coupon: ICoupon, amount: number): number {
  let discount = 0;
  if (coupon.discountType === 'FIXED') {
    discount = Number(coupon.discountValue) || 0;
  } else {
    discount = (amount * (Number(coupon.discountValue) || 0)) / 100;
  }
  discount = round2(Math.max(0, discount));
  return Math.min(discount, round2(amount));
}

function normalizeLineItems(raw: unknown): CouponLineItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const serviceId = String((row as any)?.serviceId || '').trim();
      const amount = round2(Number((row as any)?.amount) || 0);
      return { serviceId, amount };
    })
    .filter((row) => row.serviceId && row.amount > 0);
}

/**
 * Resolve the amount a coupon may discount.
 * Prefer per-line service (pre-GST) amounts when provided:
 * - SELECTED_SERVICES → matching lines only
 * - ALL_SERVICES → all line items
 * GST is calculated on the discounted service subtotal (caller recalculates per category).
 */
function resolveDiscountBase(params: {
  coupon: ICoupon;
  orderAmount: number;
  serviceIds: string[];
  lineItems: CouponLineItemInput[];
}): {
  discountBase: number;
  eligibleServiceIds: string[];
  eligible: boolean;
} {
  const { coupon, orderAmount, serviceIds, lineItems } = params;

  if (lineItems.length > 0) {
    if (coupon.applicableTo === 'SELECTED_SERVICES') {
      const allowed = new Set((coupon.serviceIds || []).map((s) => s.trim().toLowerCase()));
      const matching = lineItems.filter((l) => allowed.has(l.serviceId.toLowerCase()));
      const eligibleServiceIds = [...new Set(matching.map((l) => l.serviceId))];
      const discountBase = round2(matching.reduce((sum, l) => sum + l.amount, 0));
      return {
        discountBase,
        eligibleServiceIds,
        eligible: discountBase > 0,
      };
    }

    const eligibleServiceIds = [...new Set(lineItems.map((l) => l.serviceId))];
    const discountBase = round2(lineItems.reduce((sum, l) => sum + l.amount, 0));
    return {
      discountBase,
      eligibleServiceIds,
      eligible: discountBase > 0,
    };
  }

  if (coupon.applicableTo === 'SELECTED_SERVICES') {
    const allowed = new Set((coupon.serviceIds || []).map((s) => s.trim().toLowerCase()));
    const eligibleServiceIds = serviceIds.filter((id) => allowed.has(id.toLowerCase()));
    return {
      discountBase: orderAmount,
      eligibleServiceIds,
      eligible: eligibleServiceIds.length > 0,
    };
  }

  return {
    discountBase: orderAmount,
    eligibleServiceIds: serviceIds.length
      ? [...new Set(serviceIds.map((s) => s.trim()).filter(Boolean))]
      : [],
    eligible: true,
  };
}

function assertCreatePayload(payload: Record<string, unknown>) {
  const code = normalizeCouponCode(String(payload.code || ''));
  if (!code) throw new BadRequestError('Coupon code is required', COUPON_ERROR_CODES.INVALID_REQUEST);

  const discountType = String(payload.discountType || '').toUpperCase() as DiscountType;
  if (!DISCOUNT_TYPES.includes(discountType)) {
    throw new BadRequestError('discountType must be FIXED or PERCENTAGE', COUPON_ERROR_CODES.INVALID_REQUEST);
  }

  const discountValue = Number(payload.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new BadRequestError('discountValue must be a positive number', COUPON_ERROR_CODES.INVALID_REQUEST);
  }
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    throw new BadRequestError('Percentage discount cannot exceed 100', COUPON_ERROR_CODES.INVALID_REQUEST);
  }

  const applicableTo = String(payload.applicableTo || 'ALL_SERVICES').toUpperCase() as ApplicabilityType;
  if (!APPLICABILITY_TYPES.includes(applicableTo)) {
    throw new BadRequestError('Invalid applicableTo', COUPON_ERROR_CODES.INVALID_REQUEST);
  }

  const serviceIds = Array.isArray(payload.serviceIds)
    ? payload.serviceIds.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (applicableTo === 'SELECTED_SERVICES' && serviceIds.length === 0) {
    throw new BadRequestError(
      'serviceIds required when applicableTo is SELECTED_SERVICES',
      COUPON_ERROR_CODES.INVALID_REQUEST
    );
  }

  const applicableFlows = (Array.isArray(payload.applicableFlows) ? payload.applicableFlows : [])
    .map((f) => String(f).toUpperCase())
    .filter((f): f is FlowType => (FLOW_TYPES as readonly string[]).includes(f));
  if (applicableFlows.length === 0) {
    throw new BadRequestError('applicableFlows is required', COUPON_ERROR_CODES.INVALID_REQUEST);
  }

  const redemptionScope = String(payload.redemptionScope || 'PER_USER').toUpperCase() as CouponRedemptionScope;
  if (!COUPON_REDEMPTION_SCOPES.includes(redemptionScope)) {
    throw new BadRequestError('Invalid redemptionScope', COUPON_ERROR_CODES.INVALID_REQUEST);
  }

  return {
    code,
    discountType,
    discountValue,
    minOrderAmount: Math.max(0, Number(payload.minOrderAmount) || 0),
    applicableTo,
    serviceIds: applicableTo === 'ALL_SERVICES' ? [] : serviceIds,
    applicableFlows,
    redemptionScope,
    firstBookingOnly: Boolean(payload.firstBookingOnly),
    usageLimitPerUser:
      redemptionScope === 'GLOBAL_SINGLE_USE'
        ? 1
        : Math.max(1, Math.floor(Number(payload.usageLimitPerUser) || 1)),
    startDate: payload.startDate ? new Date(String(payload.startDate)) : new Date(),
    expiryDate: payload.expiryDate ? new Date(String(payload.expiryDate)) : null,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
  };
}

export class CouponService {
  static async createCoupon(payload: Record<string, unknown>): Promise<ICoupon> {
    const data = assertCreatePayload(payload);
    const existing = await Coupon.findOne({ code: data.code }).lean();
    if (existing) {
      throw new ConflictError('Coupon code already exists', COUPON_ERROR_CODES.INVALID_REQUEST);
    }
    return Coupon.create(data);
  }

  static async listCoupons(filters: {
    isActive?: boolean;
    search?: string;
  } = {}): Promise<ICoupon[]> {
    const query: Record<string, unknown> = {};
    if (typeof filters.isActive === 'boolean') query.isActive = filters.isActive;
    if (filters.search) {
      query.code = { $regex: normalizeCouponCode(filters.search), $options: 'i' };
    }
    return Coupon.find(query).sort({ createdAt: -1 });
  }

  static async getCouponById(id: string): Promise<ICoupon> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Coupon not found', COUPON_ERROR_CODES.COUPON_NOT_FOUND);
    }
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new NotFoundError('Coupon not found', COUPON_ERROR_CODES.COUPON_NOT_FOUND);
    }
    return coupon;
  }

  static async updateCoupon(id: string, payload: Record<string, unknown>): Promise<ICoupon> {
    const coupon = await this.getCouponById(id);
    const allowed = [
      'discountType',
      'discountValue',
      'minOrderAmount',
      'applicableTo',
      'serviceIds',
      'applicableFlows',
      'redemptionScope',
      'firstBookingOnly',
      'usageLimitPerUser',
      'startDate',
      'expiryDate',
      'isActive',
    ] as const;

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        (coupon as any)[key] = payload[key];
      }
    }

    if (payload.code !== undefined) {
      const nextCode = normalizeCouponCode(String(payload.code));
      if (nextCode && nextCode !== coupon.code) {
        const clash = await Coupon.findOne({ code: nextCode, _id: { $ne: coupon._id } });
        if (clash) {
          throw new ConflictError('Coupon code already exists', COUPON_ERROR_CODES.INVALID_REQUEST);
        }
        coupon.code = nextCode;
      }
    }

    if (coupon.applicableTo === 'ALL_SERVICES') {
      coupon.serviceIds = [];
    } else if (!coupon.serviceIds?.length) {
      throw new BadRequestError(
        'serviceIds required when applicableTo is SELECTED_SERVICES',
        COUPON_ERROR_CODES.INVALID_REQUEST
      );
    }

    if (!coupon.redemptionScope) {
      coupon.redemptionScope = 'PER_USER';
    }
    if (coupon.redemptionScope === 'GLOBAL_SINGLE_USE') {
      coupon.usageLimitPerUser = 1;
    }

    await coupon.save();
    return coupon;
  }

  static async setCouponStatus(id: string, isActive: boolean): Promise<ICoupon> {
    const coupon = await this.getCouponById(id);
    coupon.isActive = Boolean(isActive);
    await coupon.save();
    return coupon;
  }

  static async deleteCoupon(id: string): Promise<void> {
    const coupon = await this.getCouponById(id);
    await coupon.deleteOne();
  }

  static async validateCoupon(params: {
    couponCode: string;
    userId: string;
    flowType: string;
    amount: number;
    serviceIds?: string[];
    /** Optional per-service amounts so SELECTED_SERVICES coupons discount only matching lines. */
    lineItems?: CouponLineItemInput[];
    skipActiveRedemptionCheck?: boolean;
  }): Promise<ValidationResult> {
    const code = normalizeCouponCode(params.couponCode);
    const userId = String(params.userId || '').trim();
    const flowType = String(params.flowType || '').toUpperCase() as FlowType;
    const amount = round2(Number(params.amount) || 0);
    const serviceIds = (params.serviceIds || []).map((s) => String(s).trim()).filter(Boolean);
    const lineItems = normalizeLineItems(params.lineItems);

    if (!code) return fail(COUPON_ERROR_CODES.COUPON_NOT_FOUND);
    if (!userId) return fail(COUPON_ERROR_CODES.INVALID_REQUEST, 'Authenticated user is required.');
    if (!(FLOW_TYPES as readonly string[]).includes(flowType)) {
      return fail(COUPON_ERROR_CODES.FLOW_NOT_ELIGIBLE);
    }
    if (!(amount > 0)) {
      return fail(COUPON_ERROR_CODES.INVALID_REQUEST, 'A valid order amount is required.');
    }

    const coupon = await Coupon.findOne({ code });
    if (!coupon) return fail(COUPON_ERROR_CODES.COUPON_NOT_FOUND);
    if (!coupon.isActive) return fail(COUPON_ERROR_CODES.COUPON_INACTIVE);
    const redemptionScope = coupon.redemptionScope || 'PER_USER';

    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      return fail(COUPON_ERROR_CODES.COUPON_NOT_STARTED);
    }
    if (coupon.expiryDate && coupon.expiryDate < now) {
      return fail(COUPON_ERROR_CODES.COUPON_EXPIRED);
    }
    if (!coupon.applicableFlows.includes(flowType)) {
      return fail(COUPON_ERROR_CODES.FLOW_NOT_ELIGIBLE);
    }

    const { discountBase, eligibleServiceIds, eligible } = resolveDiscountBase({
      coupon,
      orderAmount: amount,
      serviceIds,
      lineItems,
    });

    if (!eligible) {
      return fail(COUPON_ERROR_CODES.SERVICE_NOT_ELIGIBLE);
    }

    const minOrderCheckAmount = lineItems.length > 0 ? discountBase : amount;

    if (minOrderCheckAmount < Number(coupon.minOrderAmount || 0)) {
      const shortfall = round2(Number(coupon.minOrderAmount) - minOrderCheckAmount);
      return fail(
        COUPON_ERROR_CODES.MINIMUM_ORDER_NOT_MET,
        `Add ₹${shortfall} more to use this coupon.`
      );
    }

    const redeemedCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
      status: 'REDEEMED',
    });

    if (redemptionScope === 'GLOBAL_SINGLE_USE') {
      const globallyUsed = await CouponRedemption.exists({
        couponId: coupon._id,
        redemptionScope: 'GLOBAL_SINGLE_USE',
        status: 'REDEEMED',
      });
      if (globallyUsed) {
        return fail(COUPON_ERROR_CODES.COUPON_ALREADY_USED, 'This coupon has already been claimed.');
      }
    } else if (redeemedCount >= coupon.usageLimitPerUser) {
      return fail(COUPON_ERROR_CODES.COUPON_ALREADY_USED);
    }

    if (!params.skipActiveRedemptionCheck) {
      const activeQuery =
        redemptionScope === 'GLOBAL_SINGLE_USE'
          ? {
              couponId: coupon._id,
              redemptionScope: 'GLOBAL_SINGLE_USE' as CouponRedemptionScope,
              status: 'PENDING' as const,
            }
          : {
              couponId: coupon._id,
              userId,
              status: 'PENDING' as const,
            };
      const active = await CouponRedemption.findOne(activeQuery).lean();
      if (active) {
        return fail(
          COUPON_ERROR_CODES.COUPON_REDEMPTION_CONFLICT,
          redemptionScope === 'GLOBAL_SINGLE_USE'
            ? 'This coupon is currently being claimed on another payment. Please try again shortly.'
            : undefined
        );
      }
    }

    if (coupon.firstBookingOnly) {
      try {
        const hasPaid = await PaymentServiceClient.hasSuccessfulPayment(userId);
        if (hasPaid || redeemedCount > 0) {
          return fail(COUPON_ERROR_CODES.NOT_ELIGIBLE_FOR_FIRST_BOOKING);
        }
      } catch {
        return fail(
          COUPON_ERROR_CODES.NOT_ELIGIBLE_FOR_FIRST_BOOKING,
          'Unable to verify first-booking eligibility. Please try again.'
        );
      }
    }

    const discountAmount = calculateDiscount(coupon, discountBase);
    if (discountAmount <= 0) {
      return fail(COUPON_ERROR_CODES.COUPON_NOT_APPLICABLE);
    }

    return {
      valid: true,
      couponId: String(coupon._id),
      couponCode: coupon.code,
      redemptionScope,
      discountType: coupon.discountType,
      discountAmount,
      originalAmount: amount,
      amountAfterCoupon: round2(Math.max(0, amount - discountAmount)),
      eligibleAmount: discountBase,
      eligibleServiceIds,
    };
  }

  /**
   * List active coupons for a checkout context with availability status per coupon.
   */
  static async listEligibleForUser(params: {
    userId: string;
    flowType: string;
    amount: number;
    serviceIds?: string[];
    lineItems?: CouponLineItemInput[];
  }): Promise<
    Array<{
      couponId: string;
      couponCode: string;
      discountType: DiscountType;
      discountValue: number;
      minOrderAmount: number;
      status: 'AVAILABLE' | 'ALREADY_USED' | 'NOT_AVAILABLE';
      message: string;
      discountAmount?: number;
      originalAmount?: number;
      amountAfterCoupon?: number;
      eligibleAmount?: number;
      eligibleServiceIds?: string[];
      code?: CouponErrorCode;
    }>
  > {
    const userId = String(params.userId || '').trim();
    const flowType = String(params.flowType || '').toUpperCase() as FlowType;
    const amount = round2(Number(params.amount) || 0);
    const serviceIds = (params.serviceIds || []).map((s) => String(s).trim()).filter(Boolean);
    const lineItems = normalizeLineItems(params.lineItems);

    if (!userId) {
      throw new BadRequestError('Authenticated user is required', COUPON_ERROR_CODES.INVALID_REQUEST);
    }
    if (!(FLOW_TYPES as readonly string[]).includes(flowType)) {
      throw new BadRequestError('Invalid flowType', COUPON_ERROR_CODES.INVALID_REQUEST);
    }
    if (!(amount > 0)) {
      throw new BadRequestError('A valid order amount is required.', COUPON_ERROR_CODES.INVALID_REQUEST);
    }

    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      applicableFlows: flowType,
      redemptionScope: { $ne: 'GLOBAL_SINGLE_USE' },
      startDate: { $lte: now },
      $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }],
    })
      .sort({ code: 1 })
      .lean();

    const results: Array<{
      couponId: string;
      couponCode: string;
      discountType: DiscountType;
      discountValue: number;
      minOrderAmount: number;
      status: 'AVAILABLE' | 'ALREADY_USED' | 'NOT_AVAILABLE';
      message: string;
      discountAmount?: number;
      originalAmount?: number;
      amountAfterCoupon?: number;
      eligibleAmount?: number;
      eligibleServiceIds?: string[];
      code?: CouponErrorCode;
    }> = [];

    for (const coupon of coupons) {
      const validation = await this.validateCoupon({
        couponCode: coupon.code,
        userId,
        flowType,
        amount,
        serviceIds,
        lineItems,
        skipActiveRedemptionCheck: true,
      });

      if (validation.valid) {
        const onServices =
          validation.eligibleServiceIds.length > 0 &&
          validation.eligibleAmount < validation.originalAmount - 0.001
            ? ` on selected services`
            : '';
        results.push({
          couponId: validation.couponId,
          couponCode: validation.couponCode,
          discountType: validation.discountType,
          discountValue: Number(coupon.discountValue) || 0,
          minOrderAmount: Number(coupon.minOrderAmount) || 0,
          status: 'AVAILABLE',
          message: `₹${validation.discountAmount.toLocaleString('en-IN')} off${onServices}`,
          discountAmount: validation.discountAmount,
          originalAmount: validation.originalAmount,
          amountAfterCoupon: validation.amountAfterCoupon,
          eligibleAmount: validation.eligibleAmount,
          eligibleServiceIds: validation.eligibleServiceIds,
        });
        continue;
      }

      const used =
        validation.code === COUPON_ERROR_CODES.COUPON_ALREADY_USED ||
        validation.code === COUPON_ERROR_CODES.COUPON_USAGE_LIMIT_REACHED;

      results.push({
        couponId: String(coupon._id),
        couponCode: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue) || 0,
        minOrderAmount: Number(coupon.minOrderAmount) || 0,
        status: used ? 'ALREADY_USED' : 'NOT_AVAILABLE',
        message: validation.message,
        code: validation.code,
      });
    }

    const rank = (s: string) => (s === 'AVAILABLE' ? 0 : s === 'ALREADY_USED' ? 1 : 2);
    results.sort((a, b) => {
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      if (a.status === 'AVAILABLE') {
        return (b.discountAmount || 0) - (a.discountAmount || 0);
      }
      return a.couponCode.localeCompare(b.couponCode);
    });

    return results;
  }

  static async reserveRedemption(params: {
    couponCode: string;
    userId: string;
    flowType: string;
    amount: number;
    serviceIds?: string[];
    lineItems?: CouponLineItemInput[];
    bookingOrderId?: string | null;
    taskId?: string | null;
  }): Promise<{
    success: boolean;
    redemption?: ICouponRedemption;
    validation?: ValidationSuccess;
    error?: ValidationFailure;
  }> {
    const validation = await this.validateCoupon({
      ...params,
      skipActiveRedemptionCheck: false,
    });

    if (!validation.valid) {
      return { success: false, error: validation };
    }

    const env = validateEnv();
    const expiresAt = new Date(
      Date.now() + Math.max(1, env.PENDING_REDEMPTION_TTL_MINUTES) * 60 * 1000
    );

    try {
      const redemption = await CouponRedemption.create({
        couponId: validation.couponId,
        couponCode: validation.couponCode,
        userId: String(params.userId).trim(),
        flowType: String(params.flowType).toUpperCase(),
        redemptionScope: validation.redemptionScope,
        bookingOrderId: params.bookingOrderId || null,
        taskId: params.taskId || null,
        discountAmount: validation.discountAmount,
        status: 'PENDING',
        expiresAt,
      });

      return { success: true, redemption, validation };
    } catch (error: unknown) {
      const mongoError = error as { code?: number };
      if (mongoError?.code === 11000) {
        return {
          success: false,
          error: fail(COUPON_ERROR_CODES.COUPON_REDEMPTION_CONFLICT),
        };
      }
      throw error;
    }
  }

  static async confirmRedemption(redemptionId: string): Promise<ICouponRedemption> {
    const redemption = await CouponRedemption.findById(redemptionId);
    if (!redemption) {
      throw new NotFoundError('Redemption not found', COUPON_ERROR_CODES.COUPON_NOT_FOUND);
    }
    if (redemption.status === 'REDEEMED') return redemption;
    if (redemption.status !== 'PENDING') {
      throw new BadRequestError(
        `Cannot confirm redemption in status ${redemption.status}`,
        COUPON_ERROR_CODES.COUPON_REDEMPTION_CONFLICT
      );
    }

    redemption.status = 'REDEEMED';
    redemption.redeemedAt = new Date();
    redemption.expiresAt = null;
    await redemption.save();
    logger.info('Coupon redemption confirmed', {
      redemptionId,
      couponCode: redemption.couponCode,
      userId: redemption.userId,
    });
    return redemption;
  }

  static async cancelRedemption(redemptionId: string): Promise<ICouponRedemption | null> {
    const redemption = await CouponRedemption.findById(redemptionId);
    if (!redemption) return null;
    if (redemption.status !== 'PENDING') return redemption;

    redemption.status = 'CANCELLED';
    await redemption.save();
    logger.info('Coupon redemption cancelled', {
      redemptionId,
      couponCode: redemption.couponCode,
      userId: redemption.userId,
    });
    return redemption;
  }

  static async expirePendingRedemptions(): Promise<number> {
    const now = new Date();
    const result = await CouponRedemption.updateMany(
      {
        status: 'PENDING',
        expiresAt: { $ne: null, $lte: now },
      },
      {
        $set: { status: 'EXPIRED', updatedAt: now },
      }
    );
    const count = result.modifiedCount || 0;
    if (count > 0) {
      logger.info('Expired pending coupon redemptions', { count });
    }
    return count;
  }

  /** Idempotent FIRST100 seed */
  static async seedFirst100(): Promise<{ created: boolean; coupon: ICoupon }> {
    const code = 'FIRST100';
    const existing = await Coupon.findOne({ code });
    if (existing) {
      return { created: false, coupon: existing };
    }

    const coupon = await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 100,
      minOrderAmount: 499,
      applicableTo: 'ALL_SERVICES',
      serviceIds: [],
      applicableFlows: ['BOOK_NOW', 'POST_COMPARE'],
      redemptionScope: 'PER_USER',
      firstBookingOnly: true,
      usageLimitPerUser: 1,
      startDate: new Date(),
      expiryDate: null,
      isActive: true,
    });

    logger.info('Seeded FIRST100 coupon');
    return { created: true, coupon };
  }
}
