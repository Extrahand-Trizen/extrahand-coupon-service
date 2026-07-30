import dns from 'node:dns';
import mongoose from 'mongoose';
import logger from './logger';
import { validateEnv } from './env';

const DNS_FALLBACK_SERVERS = ['8.8.8.8', '8.8.4.4'];

try {
  dns.setServers(DNS_FALLBACK_SERVERS);
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // ignore DNS override failures
}

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  const env = validateEnv();
  let uri = env.MONGODB_URI;
  if (uri.includes('appName=Cluster0w=majority')) {
    uri = uri.replace(/appName=Cluster0w=majority&appName=Cluster0/, 'appName=Cluster0');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    dbName: env.MONGODB_DB || 'extrahand',
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 20000,
    maxPoolSize: 10,
    minPoolSize: 2,
    family: 4,
  });

  isConnected = true;
  logger.info('✅ Coupon Service connected to MongoDB', { db: env.MONGODB_DB });
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
