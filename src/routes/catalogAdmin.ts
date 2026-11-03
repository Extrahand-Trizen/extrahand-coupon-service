import { Router, Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';
import { serviceOrAdminAuthMiddleware } from '../middleware/adminSession';
import { validateEnv } from '../config/env';
import logger from '../config/logger';

/**
 * Catalog content admin for the coupon portal. Admin sessions and backend service requests are
 * accepted; this service forwards to task-service with the server-side service token.
 */
const router = Router();

const ALLOWED_CATALOG_PATH = /^\/internal\/(skus|categories|hub-sections|help-support)(\/|$)/;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

router.use(serviceOrAdminAuthMiddleware);

router.use(
  asyncHandler(async (req: Request, res: Response) => {
    if (!ALLOWED_METHODS.has(req.method) || !ALLOWED_CATALOG_PATH.test(req.path)) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const env = validateEnv();
    const session = (req as Request & { adminSession?: { username: string } }).adminSession;
    const response = await axios.request({
      method: req.method,
      url: `${env.TASK_SERVICE_URL}/api/v1/catalog${req.url}`,
      data: ['GET', 'DELETE'].includes(req.method) ? undefined : req.body,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Auth': env.SERVICE_AUTH_TOKEN,
        'X-Service-Name': 'coupon-service',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    logger.info('Coupon portal catalog admin request', {
      method: req.method,
      path: req.path,
      status: response.status,
      admin: session?.username,
    });
    res.status(response.status).json(response.data);
  }),
);

export default router;
