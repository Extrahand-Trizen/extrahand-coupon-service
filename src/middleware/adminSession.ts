import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validateEnv } from '../config/env';
import logger from '../config/logger';

/**
 * Coupon-portal admin sessions. The browser holds a short-lived signed session token issued at
 * login and never a service credential; the service token stays on the server.
 */

export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminSession = { username: string; role: string; exp: number };

const encode = (value: Buffer | string) => Buffer.from(value).toString('base64url');

function signingKey(): Buffer {
  const env = validateEnv();
  if (env.ADMIN_SESSION_SECRET) return Buffer.from(env.ADMIN_SESSION_SECRET);
  return createHmac('sha256', env.SERVICE_AUTH_TOKEN).update('coupon-portal-admin-session').digest();
}

function sign(payload: string): string {
  return encode(createHmac('sha256', signingKey()).update(payload).digest());
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueAdminSessionToken(
  user: { username: string; role?: string | null },
  now: number = Date.now(),
): { token: string; expiresAt: string } {
  const exp = now + ADMIN_SESSION_TTL_MS;
  const payload = encode(JSON.stringify({ username: user.username, role: user.role || 'ADMIN', exp }));
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

export function verifyAdminSessionToken(token: string, now: number = Date.now()): AdminSession | null {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
    if (!session?.username || !Number.isFinite(session.exp) || session.exp <= now) return null;
    return session;
  } catch {
    return null;
  }
}

function bearerToken(req: Request): string {
  const match = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''));
  return match?.[1]?.trim() || '';
}

function hasValidServiceAuth(req: Request): boolean {
  const provided = String(req.headers['x-service-auth'] || '').trim();
  const expected = String(validateEnv().SERVICE_AUTH_TOKEN || '').trim();
  return Boolean(provided && expected && safeEqual(provided, expected));
}

function attachAdminSession(req: Request): AdminSession | null {
  const session = verifyAdminSessionToken(bearerToken(req));
  if (session) (req as Request & { adminSession?: AdminSession }).adminSession = session;
  return session;
}

function rejectUnauthenticated(req: Request, res: Response): void {
  logger.warn('Coupon admin request without a valid admin session', { url: req.url, method: req.method });
  res.status(401).json({ success: false, error: 'Admin session required', message: 'Please sign in again' });
}

/** Admin APIs: a coupon-portal admin session, or a backend service holding the service token. */
export function serviceOrAdminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (hasValidServiceAuth(req) || attachAdminSession(req)) {
    next();
    return;
  }
  rejectUnauthenticated(req, res);
}

/** Routes that act for a signed-in portal admin only. */
export function adminSessionAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (attachAdminSession(req)) {
    next();
    return;
  }
  rejectUnauthenticated(req, res);
}
