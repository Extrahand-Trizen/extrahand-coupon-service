import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).refine((n) => n > 0 && n < 65536).default('4015'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().default('extrahand'),
  SERVICE_AUTH_TOKEN: z.string().min(1, 'SERVICE_AUTH_TOKEN is required'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:4009'),
  PENDING_REDEMPTION_TTL_MINUTES: z.string().transform(Number).default('30'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('1000'),
  LOCAL_ADMIN_USERNAME: z.string().default('admin'),
  LOCAL_ADMIN_PASSWORD: z.string().default('admin123'),
});

export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export function getCorsConfig(env: ReturnType<typeof validateEnv>) {
  const origins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: origins.length > 0 ? origins : true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Service-Auth',
      'X-Service-Name',
      'X-User-Id',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
}
