import { timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';
import { validateEnv } from '../config/env';
import logger from '../config/logger';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function tryLocalAdminLogin(
  env: ReturnType<typeof validateEnv>,
  username: string,
  password: string,
): { username: string; email: null; role: string } | null {
  const localUser = String(env.LOCAL_ADMIN_USERNAME || '').trim();
  const localPass = String(env.LOCAL_ADMIN_PASSWORD || '');
  if (!localUser || !localPass) return null;
  if (!safeEqual(username, localUser) || !safeEqual(password, localPass)) return null;
  return { username: localUser, email: null, role: 'ADMIN' };
}

/**
 * Coupon portal admin login — prefers corporate AdminUser via payment-service
 * (financial dashboard Postgres). Falls back to LOCAL_ADMIN_* when payment
 * is unreachable so local coupon-portal work does not require payment-service.
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
    const user = String(username).trim();
    const pass = String(password);

    try {
      const response = await axios.post(
        `${env.PAYMENT_SERVICE_URL}/api/v1/admin/login`,
        { username: user, password: pass },
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
      const local = tryLocalAdminLogin(env, user, pass);
      if (local) {
        logger.warn('Admin login via LOCAL_ADMIN_* (payment-service unreachable)', {
          error: err instanceof Error ? err.message : String(err),
          username: local.username,
        });
        return res.status(200).json({
          success: true,
          user: local,
        });
      }

      logger.error('Admin login via payment-service failed', {
        error: err instanceof Error ? err.message : String(err),
        hasLocalAdmin: Boolean(env.LOCAL_ADMIN_USERNAME && env.LOCAL_ADMIN_PASSWORD),
      });
      return res.status(503).json({
        success: false,
        error: env.LOCAL_ADMIN_USERNAME
          ? 'Invalid credentials (payment-service unavailable; local admin rejected)'
          : 'Login service temporarily unavailable',
      });
    }
  });
}
