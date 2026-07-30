import { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';
import { validateEnv } from '../config/env';
import logger from '../config/logger';

/**
 * Coupon portal admin login — same corporate AdminUser as payment-service
 * (financial dashboard). Stored in payment Postgres `AdminUser` table.
 */
export class AdminAuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    const env = validateEnv();

    try {
      const response = await axios.post(
        `${env.PAYMENT_SERVICE_URL}/api/v1/admin/login`,
        { username: String(username).trim(), password: String(password) },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          validateStatus: () => true,
        }
      );

      if (response.status === 200 && response.data?.success && response.data?.user?.username) {
        return res.status(200).json({
          success: true,
          user: {
            username: String(response.data.user.username),
            email: response.data.user.email ?? null,
            role: response.data.user.role ?? 'ADMIN',
          },
        });
      }

      return res.status(response.status === 401 ? 401 : 400).json({
        success: false,
        error: response.data?.error || response.data?.message || 'Invalid credentials',
      });
    } catch (err) {
      logger.error('Admin login via payment-service failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(503).json({
        success: false,
        error: 'Login service temporarily unavailable',
      });
    }
  });
}
