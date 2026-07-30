import { Request, Response } from 'express';
import { CouponService } from '../services/CouponService';
import { BadRequestError } from '../errors/AppError';
import { FLOW_TYPES } from '../constants/coupon';

function resolveUserId(req: Request): string {
  const fromHeader = String(req.headers['x-user-id'] || '').trim();
  const fromBody = String((req.body as any)?.userId || '').trim();
  // Prefer trusted service-forwarded header; body only as fallback for internal tools
  return fromHeader || fromBody;
}

export class CouponController {
  static async validate(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const result = await CouponService.validateCoupon({
      couponCode: String(req.body?.couponCode || ''),
      userId,
      flowType: String(req.body?.flowType || ''),
      amount: Number(req.body?.amount),
      serviceIds: Array.isArray(req.body?.serviceIds) ? req.body.serviceIds : [],
      lineItems: Array.isArray(req.body?.lineItems) ? req.body.lineItems : [],
    });

    if (!result.valid) {
      res.status(400).json({
        success: false,
        valid: false,
        code: result.code,
        message: result.message,
        error: result.message,
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      couponId: result.couponId,
      couponCode: result.couponCode,
      discountType: result.discountType,
      discountAmount: result.discountAmount,
      originalAmount: result.originalAmount,
      amountAfterCoupon: result.amountAfterCoupon,
      eligibleAmount: result.eligibleAmount,
      eligibleServiceIds: result.eligibleServiceIds,
    });
  }

  static async listEligible(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    if (!userId) {
      throw new BadRequestError('Authenticated user is required');
    }

    const coupons = await CouponService.listEligibleForUser({
      userId,
      flowType: String(req.body?.flowType || ''),
      amount: Number(req.body?.amount),
      serviceIds: Array.isArray(req.body?.serviceIds) ? req.body.serviceIds : [],
      lineItems: Array.isArray(req.body?.lineItems) ? req.body.lineItems : [],
    });

    res.json({
      success: true,
      coupons,
    });
  }

  static async reserve(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    const result = await CouponService.reserveRedemption({
      couponCode: String(req.body?.couponCode || ''),
      userId,
      flowType: String(req.body?.flowType || ''),
      amount: Number(req.body?.amount),
      serviceIds: Array.isArray(req.body?.serviceIds) ? req.body.serviceIds : [],
      lineItems: Array.isArray(req.body?.lineItems) ? req.body.lineItems : [],
      bookingOrderId: req.body?.bookingOrderId || null,
      taskId: req.body?.taskId || null,
    });

    if (!result.success || !result.redemption || !result.validation) {
      const err = result.error;
      res.status(409).json({
        success: false,
        valid: false,
        code: err?.code,
        message: err?.message,
        error: err?.message || 'Failed to reserve coupon',
      });
      return;
    }

    res.status(201).json({
      success: true,
      redemption: {
        id: String(result.redemption._id),
        couponId: result.validation.couponId,
        couponCode: result.validation.couponCode,
        discountAmount: result.validation.discountAmount,
        amountAfterCoupon: result.validation.amountAfterCoupon,
        originalAmount: result.validation.originalAmount,
        eligibleAmount: result.validation.eligibleAmount,
        eligibleServiceIds: result.validation.eligibleServiceIds,
        status: result.redemption.status,
        expiresAt: result.redemption.expiresAt,
      },
    });
  }

  static async confirm(req: Request, res: Response): Promise<void> {
    const redemption = await CouponService.confirmRedemption(req.params.id);
    res.json({
      success: true,
      redemption: {
        id: String(redemption._id),
        status: redemption.status,
        redeemedAt: redemption.redeemedAt,
      },
    });
  }

  static async cancel(req: Request, res: Response): Promise<void> {
    const redemption = await CouponService.cancelRedemption(req.params.id);
    res.json({
      success: true,
      redemption: redemption
        ? { id: String(redemption._id), status: redemption.status }
        : null,
    });
  }

  static async expirePending(_req: Request, res: Response): Promise<void> {
    const count = await CouponService.expirePendingRedemptions();
    res.json({ success: true, expiredCount: count });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const coupon = await CouponService.createCoupon(req.body || {});
    res.status(201).json({ success: true, coupon });
  }

  static async list(req: Request, res: Response): Promise<void> {
    const isActive =
      req.query.isActive === undefined
        ? undefined
        : String(req.query.isActive) === 'true';
    const coupons = await CouponService.listCoupons({
      isActive,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    res.json({ success: true, coupons });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const coupon = await CouponService.getCouponById(req.params.id);
    res.json({ success: true, coupon });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const coupon = await CouponService.updateCoupon(req.params.id, req.body || {});
    res.json({ success: true, coupon });
  }

  static async setStatus(req: Request, res: Response): Promise<void> {
    if (typeof req.body?.isActive !== 'boolean') {
      throw new BadRequestError('isActive boolean is required');
    }
    const coupon = await CouponService.setCouponStatus(req.params.id, req.body.isActive);
    res.json({ success: true, coupon });
  }

  static async remove(req: Request, res: Response): Promise<void> {
    await CouponService.deleteCoupon(req.params.id);
    res.json({ success: true, deleted: true });
  }
}

// silence unused import warning for FLOW_TYPES if not used — used for docs
void FLOW_TYPES;
