import { Router } from 'express';
import { CouponController } from '../controllers/CouponController';
import { asyncHandler } from '../middleware/errorHandler';
import { serviceAuthMiddleware } from '../middleware/serviceAuth';
import { serviceOrAdminAuthMiddleware } from '../middleware/adminSession';

const router = Router();
const adminRouter = Router();

// Admin management — coupon-portal admin session (browser) or service-to-service auth
adminRouter.post('/coupons', asyncHandler(CouponController.create));
adminRouter.post('/coupons/bulk', asyncHandler(CouponController.bulkCreate));
adminRouter.get('/coupons', asyncHandler(CouponController.list));
adminRouter.get('/coupons/:id', asyncHandler(CouponController.getById));
adminRouter.patch('/coupons/:id', asyncHandler(CouponController.update));
adminRouter.patch('/coupons/:id/status', asyncHandler(CouponController.setStatus));
adminRouter.delete('/coupons/:id', asyncHandler(CouponController.remove));
router.use('/admin', serviceOrAdminAuthMiddleware, adminRouter);

// Customer / payment-service flows require service-to-service auth (gateway / payment-service)
router.use(serviceAuthMiddleware);
router.get('/home-offers', asyncHandler(CouponController.listHomeOffers));
router.post('/validate', asyncHandler(CouponController.validate));
router.post('/eligible', asyncHandler(CouponController.listEligible));
router.post('/redemptions/reserve', asyncHandler(CouponController.reserve));
router.post('/redemptions/:id/confirm', asyncHandler(CouponController.confirm));
router.post('/redemptions/:id/cancel', asyncHandler(CouponController.cancel));
router.post('/redemptions/expire-pending', asyncHandler(CouponController.expirePending));

export default router;
