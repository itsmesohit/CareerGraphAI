import { Redis } from 'ioredis';
import crypto from 'crypto';

interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  responseStatus?: number;
  responseBody?: any;
  createdAt: string;
}

export class IdempotencyService {
  private static redis: Redis | null = null;
  private static inMemoryStore: Map<string, IdempotencyRecord> = new Map();
  private static TTL_SECONDS = 86400; // 24 hours

  static getRedis(): Redis | null {
    if (!this.redis && process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 800,
          retryStrategy: () => null,
        });
        this.redis.on('error', () => {
          // silent fallback to inMemoryStore
        });
      } catch {
        this.redis = null;
      }
    }
    return this.redis;
  }

  /**
   * Tries to acquire an idempotency lock for the given key and user.
   * Returns:
   * - { acquired: true } if this is the first time the key is seen.
   * - { acquired: false, status: 'PENDING' } if already executing.
   * - { acquired: false, status: 'COMPLETED', cachedResponse: ... } if already done.
   */
  static async acquireLock(
    key: string,
    userId: string,
    endpoint: string
  ): Promise<{
    acquired: boolean;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    cachedResponse?: { statusCode: number; body: any };
  }> {
    const fullKey = `careergraph:idempotency:${userId}:${key}`;
    const r = this.getRedis();

    if (r) {
      try {
        const existing = await r.get(fullKey);
        if (existing) {
          const parsed = JSON.parse(existing) as IdempotencyRecord;
          if (parsed.status === 'COMPLETED') {
            return {
              acquired: false,
              status: 'COMPLETED',
              cachedResponse: {
                statusCode: parsed.responseStatus || 200,
                body: parsed.responseBody,
              },
            };
          }
          return { acquired: false, status: parsed.status };
        }

        const record: IdempotencyRecord = {
          key,
          userId,
          endpoint,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };

        const setOk = await r.set(fullKey, JSON.stringify(record), 'EX', this.TTL_SECONDS, 'NX');
        if (!setOk) {
          // Key was created concurrently
          return { acquired: false, status: 'PENDING' };
        }

        return { acquired: true, status: 'PENDING' };
      } catch {
        // Fallback to in-memory store
      }
    }

    // In-memory fallback
    const memoryRecord = this.inMemoryStore.get(fullKey);
    if (memoryRecord) {
      if (memoryRecord.status === 'COMPLETED') {
        return {
          acquired: false,
          status: 'COMPLETED',
          cachedResponse: {
            statusCode: memoryRecord.responseStatus || 200,
            body: memoryRecord.responseBody,
          },
        };
      }
      return { acquired: false, status: memoryRecord.status };
    }

    this.inMemoryStore.set(fullKey, {
      key,
      userId,
      endpoint,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    return { acquired: true, status: 'PENDING' };
  }

  /**
   * Finalizes the idempotency record with success status and cached payload.
   */
  static async complete(
    key: string,
    userId: string,
    statusCode: number,
    responseBody: any
  ): Promise<void> {
    const fullKey = `careergraph:idempotency:${userId}:${key}`;
    const r = this.getRedis();

    const record: IdempotencyRecord = {
      key,
      userId,
      endpoint: '',
      status: 'COMPLETED',
      responseStatus: statusCode,
      responseBody,
      createdAt: new Date().toISOString(),
    };

    if (r) {
      try {
        await r.set(fullKey, JSON.stringify(record), 'EX', this.TTL_SECONDS);
        return;
      } catch {}
    }

    this.inMemoryStore.set(fullKey, record);
  }

  /**
   * Marks the operation as failed or releases lock so it can be retried.
   */
  static async release(key: string, userId: string): Promise<void> {
    const fullKey = `careergraph:idempotency:${userId}:${key}`;
    const r = this.getRedis();

    if (r) {
      try {
        await r.del(fullKey);
        return;
      } catch {}
    }

    this.inMemoryStore.delete(fullKey);
  }
}
