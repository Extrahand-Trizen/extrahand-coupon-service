import cron from 'node-cron';
import { createApp } from './app';
import { validateEnv } from './config/env';
import logger from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { CouponService } from './services/CouponService';

const env = validateEnv();

async function startServer() {
  logger.info('Starting coupon service...');

  await connectDatabase();
  const seed = await CouponService.seedFirst100();
  logger.info(
    seed.created
      ? 'FIRST100 coupon seeded'
      : 'FIRST100 coupon already exists (seed skipped)'
  );

  // Expire abandoned PENDING redemptions every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await CouponService.expirePendingRedemptions();
    } catch (error) {
      logger.error('Failed to expire pending redemptions', error);
    }
  });

  const app = createApp();
  const port = env.PORT;

  app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 Coupon Service running on 0.0.0.0:${port}`);
    logger.info(`📝 Environment: ${env.NODE_ENV}`);
    logger.info(`🔗 Health: http://localhost:${port}/api/v1/health`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down coupon service`);
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.error('Failed to start coupon service', error);
  process.exit(1);
});
