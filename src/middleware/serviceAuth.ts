import { Request, Response, NextFunction } from 'express';
import { validateEnv } from '../config/env';
import logger from '../config/logger';

export function serviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const env = validateEnv();
    const expected = env.SERVICE_AUTH_TOKEN;
    const provided = req.headers['x-service-auth'] as string | undefined;

    if (!provided) {
      logger.warn('Missing X-Service-Auth', { url: req.url, method: req.method });
      res.status(401).json({
        success: false,
        error: 'Service authentication required',
        message: 'Missing X-Service-Auth header',
      });
      return;
    }

    if (provided.trim() !== expected.trim()) {
      logger.warn('Invalid X-Service-Auth', { url: req.url, method: req.method });
      res.status(403).json({
        success: false,
        error: 'Invalid service authentication token',
      });
      return;
    }

    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Service authentication error';
    res.status(500).json({ success: false, error: message });
  }
}
