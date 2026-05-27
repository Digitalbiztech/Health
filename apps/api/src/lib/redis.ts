import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Shared Redis connection options for BullMQ queues and workers.
 * BullMQ works best when sharing a connection or using the connection URL directly.
 */
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
});

export default redisConnection;
