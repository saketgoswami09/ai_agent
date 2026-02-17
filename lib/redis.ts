import Redis from 'ioredis';

// Singleton Redis instance
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || '');

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Rate Limiter Helper (Using generic Redis logic for portability)
export async function rateLimit(identifier: string, limit: number, windowSeconds: number) {
  const key = `ratelimit:${identifier}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  return {
    success: current <= limit,
    remaining: Math.max(0, limit - current),
    reset: (await redis.ttl(key))
  };
}