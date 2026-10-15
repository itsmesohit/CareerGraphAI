import { Router, Request, Response } from 'express';
import { prisma } from '@careergraph/db';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const healthRouter = Router();

/**
 * GET /api/health
 * Liveness probe
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: '@careergraph/api',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Readiness probe inspecting PostgreSQL and Redis connectivity
 */
healthRouter.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'failed'> = {
    postgres: 'failed',
    redis: 'failed',
  };

  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (err) {
    console.error('[Health] PostgreSQL probe failed:', err);
  }

  try {
    // Check Redis
    const redis = new Redis(env.REDIS_URL, { connectTimeout: 1500, lazyConnect: true });
    await redis.connect();
    const ping = await redis.ping();
    if (ping === 'PONG') {
      checks.redis = 'ok';
    }
    await redis.quit();
  } catch (err) {
    console.error('[Health] Redis probe failed:', err);
  }

  const isReady = checks.postgres === 'ok'; // Redis failure shouldn't completely crash API in non-worker context, but report status

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
