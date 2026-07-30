import { connectDatabase, disconnectDatabase } from '../config/database';
import { CouponService } from '../services/CouponService';
import logger from '../config/logger';

async function main() {
  await connectDatabase();
  const result = await CouponService.seedFirst100();
  console.log(
    result.created
      ? `Created FIRST100 (id=${result.coupon._id})`
      : `FIRST100 already exists (id=${result.coupon._id})`
  );
  await disconnectDatabase();
}

main().catch((error) => {
  logger.error('seedFirst100 failed', error);
  process.exit(1);
});
