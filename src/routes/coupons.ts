import { Router } from 'express';
import { CouponController } from '../controllers/CouponController';
import { asyncHandler } from '../middleware/errorHandler';
import { serviceAuthMiddleware } from '../middleware/serviceAuth';

const router = Router();

// All coupon APIs require service-to-service auth (gateway / payment-service)
router.use(serviceAuthMiddleware);

// Customer / payment-service flows
router.post('/validate', asyncHandler(CouponController.validate));
router.post('/eligible', asyncHandler(CouponController.listEligible));
router.post('/redemptions/reserve', asyncHandler(CouponController.reserve));
router.post('/redemptions/:id/confirm', asyncHandler(CouponController.confirm));
router.post('/redemptions/:id/cancel', asyncHandler(CouponController.cancel));
router.post('/redemptions/expire-pending', asyncHandler(CouponController.expirePending));

// Admin management
router.post('/admin/coupons', asyncHandler(CouponController.create));
router.get('/admin/coupons', asyncHandler(CouponController.list));
router.get('/admin/coupons/:id', asyncHandler(CouponController.getById));
router.patch('/admin/coupons/:id', asyncHandler(CouponController.update));
router.patch('/admin/coupons/:id/status', asyncHandler(CouponController.setStatus));
router.delete('/admin/coupons/:id', asyncHandler(CouponController.remove));

export default router;
