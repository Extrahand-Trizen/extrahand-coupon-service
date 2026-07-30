import { Router } from 'express';
import couponRoutes from './coupons';
import adminRoutes from './admin';
import { isDatabaseConnected } from '../config/database';
import { validateEnv } from '../config/env';

const router = Router();
const env = validateEnv();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'extrahand-coupon-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    mongodb: isDatabaseConnected() ? 'connected' : 'disconnected',
  });
});

router.use('/admin', adminRoutes);
router.use('/coupons', couponRoutes);

export default router;
