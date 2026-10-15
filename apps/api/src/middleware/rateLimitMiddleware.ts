import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

// In-memory sliding window fallback store
interface WindowRecord {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, WindowRecord>();

let redisClient: Redis | null = null;
try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 1000,
    retryStrategy: () => null,
  });
  redisClient.on('error', () => {
    // Quietly fallback to memory store
  });
} catch {
  redisClient = null;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // In automated testing environments, bypass rate limits except for rate limit tests
    if (process.env.NODE_ENV === 'test' && !keyPrefix.includes('test-rl')) {
      return next();
    }

    // Generate key based on authenticated user ID or remote client IP
    const identifier = (req as any).user?.id || req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    // 1. Attempt Redis rate limiting
    if (redisClient && redisClient.status === 'ready') {
      try {
        const count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.pexpire(key, windowMs);
        }
        const ttl = await redisClient.pttl(key);
        const resetTime = Math.ceil((now + (ttl > 0 ? ttl : windowMs)) / 1000);

        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
        res.setHeader('RateLimit-Reset', resetTime);

        if (count > max) {
          res.status(429).json({
            code: 'TOO_MANY_REQUESTS',
            message,
            retryAfterSeconds: Math.ceil(ttl / 1000),
          });
          return;
        }
        return next();
      } catch (err) {
        // Fall back to in-memory store
      }
    }

    // 2. In-Memory fallback rate limiting
    let record = memoryStore.get(key);
    if (!record || now >= record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    const resetSeconds = Math.ceil(record.resetAt / 1000);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.status(429).json({
        code: 'TOO_MANY_REQUESTS',
        message,
        retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    return next();
  };
}

// Preset rate limiters
export const strictAuthRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyPrefix: 'rl:auth',
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

export const authRateLimiter = strictAuthRateLimiter;
export const otpRequestLimiter = strictAuthRateLimiter;

export const apiGeneralRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'rl:api',
});

export const automationApplyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyPrefix: 'rl:apply',
  message: 'Application submission rate limit reached. Please wait before submitting more applications.',
});
