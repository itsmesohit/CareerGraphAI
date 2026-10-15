import dotenv from 'dotenv';
import path from 'path';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { prisma, OutboxStatus } from '@careergraph/db';
import { projectOutboxEvent } from './projector.js';

import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let curDir = path.resolve(__dirname, '..');
while (curDir !== '/' && !fs.existsSync(path.join(curDir, '.env'))) {
  curDir = path.dirname(curDir);
}
if (fs.existsSync(path.join(curDir, '.env'))) {
  dotenv.config({ path: path.join(curDir, '.env') });
} else {
  dotenv.config();
}

const logger = pino({
  name: 'careergraph-worker',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

logger.info(`🔌 Worker connecting to Redis at ${redisUrl}...`);

// Outbox Projection Worker
const outboxWorker = new Worker(
  'outbox-projections',
  async (job) => {
    logger.info({ jobId: job.id, name: job.name, data: job.data }, 'Processing outbox projection event');

    if (job.data?.outboxEventId) {
      const evt = await prisma.outboxEvent.findUnique({
        where: { id: job.data.outboxEventId },
      });
      if (evt && evt.status !== OutboxStatus.PROCESSED) {
        await projectOutboxEvent(evt);
        return { processed: 1 };
      }
    }

    // Batch query any pending events from PostgreSQL
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });

    let count = 0;
    for (const evt of pendingEvents) {
      const ok = await projectOutboxEvent(evt);
      if (ok) count++;
    }

    return { processed: count };
  },
  { connection }
);

outboxWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Outbox projection completed');
});

outboxWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Outbox projection failed');
});

// Periodic Sweeper: scans PostgreSQL OutboxEvent table every 5s for pending events
let isSweeping = false;
const sweeperInterval = setInterval(async () => {
  if (isSweeping) return;
  isSweeping = true;
  try {
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      take: 15,
      orderBy: { createdAt: 'asc' },
    });

    for (const evt of pendingEvents) {
      logger.debug({ eventId: evt.id, eventType: evt.eventType }, 'Sweeper projecting pending outbox event');
      await projectOutboxEvent(evt);
    }
  } catch (err: any) {
    logger.debug({ err: err.message }, 'Outbox sweeper tick error');
  } finally {
    isSweeping = false;
  }
}, 5000);

logger.info('🚀 CareerGraph BullMQ worker initialized and listening for jobs.');

const shutdown = async () => {
  logger.info('Stopping worker gracefully...');
  clearInterval(sweeperInterval);
  await outboxWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
