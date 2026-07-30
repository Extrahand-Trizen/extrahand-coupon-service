import { Router } from 'express';
import { AdminAuthController } from '../controllers/AdminAuthController';

const router = Router();

/** Public — coupon portal admin sign-in (no X-Service-Auth) */
router.post('/login', AdminAuthController.login);

export default router;
