import axios from 'axios';
import logger from '../config/logger';
import { validateEnv } from '../config/env';

/**
 * Asks Payment Service whether the user has any successful pay-in
 * (Book Now or Post & Compare). Used for firstBookingOnly coupons.
 */
export class PaymentServiceClient {
  static async hasSuccessfulPayment(userId: string): Promise<boolean> {
    const env = validateEnv();
    const uid = String(userId || '').trim();
    if (!uid) return false;

    try {
      const response = await axios.get(
        `${env.PAYMENT_SERVICE_URL}/api/v1/internal/users/${encodeURIComponent(uid)}/has-successful-payment`,
        {
          headers: {
            'X-Service-Auth': env.SERVICE_AUTH_TOKEN,
            'X-Service-Name': 'coupon-service',
          },
          timeout: 10000,
        }
      );

      return Boolean(response.data?.hasSuccessfulPayment);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[PaymentServiceClient] hasSuccessfulPayment failed', {
        userId: uid,
        message,
      });
      // Fail closed for first-booking coupons — safer than granting incorrectly
      throw new Error('Unable to verify first-booking eligibility');
    }
  }
}
