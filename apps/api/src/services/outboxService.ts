import { prisma, graphOps, OutboxStatus } from '@careergraph/db';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({
  name: 'careergraph-outbox',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

let outboxQueue: Queue | null = null;
let redisClient: Redis | null = null;

function getOutboxQueue(): Queue | null {
  if (outboxQueue) return outboxQueue;
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy: () => null, // don't hang if redis is not running
    });

    redisClient.on('error', (err) => {
      // Quietly log without crashing
      logger.warn({ err: err.message }, 'Redis offline for BullMQ outbox queue, fallback to DB polling');
    });

    outboxQueue = new Queue('outbox-projections', {
      connection: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    return outboxQueue;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to initialize BullMQ outbox queue');
    return null;
  }
}

export interface EmitOutboxParams {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
}

export class OutboxService {
  /**
   * Emits an outbox event.
   * If a Prisma transaction client (tx) is provided, it persists atomically with the domain mutation.
   */
  async emit(
    params: EmitOutboxParams,
    txClient?: any
  ): Promise<{ id: string }> {
    const db = txClient || prisma;

    const event = await db.outboxEvent.create({
      data: {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        payload: params.payload,
        status: OutboxStatus.PENDING,
      },
    });

    // Attempt to notify BullMQ for sub-millisecond graph projection
    try {
      const q = getOutboxQueue();
      if (q) {
        await q.add(params.eventType, { outboxEventId: event.id }, { jobId: event.id });
      }
    } catch (e: any) {
      // Non-fatal: PostgreSQL outbox event status is PENDING and will be picked up by sweeper
      logger.debug({ eventId: event.id, err: e.message }, 'BullMQ job enqueue skipped, sweeper will handle');
    }

    return { id: event.id };
  }

  /**
   * Projects a single outbox event into the graph idempotently.
   */
  async projectEvent(outboxEventId: string): Promise<boolean> {
    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event || event.status === OutboxStatus.PROCESSED) {
      return true;
    }

    try {
      const payload: any = event.payload;

      switch (event.eventType) {
        case 'PROFILE_CREATED':
        case 'PROFILE_UPDATED': {
          await graphOps.projectCandidate({
            id: payload.userId || event.aggregateId,
            name: payload.fullName || payload.name || 'Candidate',
            email: payload.email || '',
            headline: payload.headline,
            completenessScore: payload.completenessScore,
            tenantId: payload.userId || event.aggregateId,
          });
          break;
        }

        case 'EXPERIENCE_CREATED':
        case 'EXPERIENCE_UPDATED': {
          await graphOps.projectExperience({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            company: payload.company,
            title: payload.title,
            startDate: payload.startDate,
            endDate: payload.endDate,
            isCurrent: payload.isCurrent,
            description: payload.description,
            metrics: payload.metrics || [],
            technologies: payload.technologies || [],
            verificationStatus: payload.verificationStatus || 'UNVERIFIED',
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'EXPERIENCE_DELETED': {
          await graphOps.deleteNode(payload.id || event.aggregateId);
          break;
        }

        case 'SKILL_CREATED':
        case 'SKILL_UPDATED': {
          await graphOps.projectSkill({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            name: payload.name,
            category: payload.category,
            proficiency: payload.proficiency,
            yearsExperience: payload.yearsExperience,
            verificationStatus: payload.verificationStatus || 'UNVERIFIED',
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'SKILL_DELETED': {
          await graphOps.deleteNode(payload.id || event.aggregateId);
          break;
        }

        case 'PROJECT_CREATED':
        case 'PROJECT_UPDATED': {
          await graphOps.projectProject({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            name: payload.name,
            role: payload.role,
            description: payload.description,
            techStack: payload.techStack || [],
            url: payload.url,
            verificationStatus: payload.verificationStatus || 'UNVERIFIED',
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'PROJECT_DELETED': {
          await graphOps.deleteNode(payload.id || event.aggregateId);
          break;
        }

        case 'EDUCATION_CREATED':
        case 'EDUCATION_UPDATED': {
          await graphOps.projectEducation({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            institution: payload.institution,
            degree: payload.degree,
            fieldOfStudy: payload.fieldOfStudy,
            startDate: payload.startDate,
            endDate: payload.endDate,
            verificationStatus: payload.verificationStatus || 'UNVERIFIED',
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'EDUCATION_DELETED': {
          await graphOps.deleteNode(payload.id || event.aggregateId);
          break;
        }

        case 'CERTIFICATION_CREATED':
        case 'CERTIFICATION_UPDATED': {
          await graphOps.projectCertification({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            name: payload.name,
            issuer: payload.issuer,
            issueDate: payload.issueDate,
            verificationStatus: payload.verificationStatus || 'UNVERIFIED',
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'CERTIFICATION_DELETED': {
          await graphOps.deleteNode(payload.id || event.aggregateId);
          break;
        }

        case 'FACT_VERIFIED':
        case 'FACT_UNVERIFIED': {
          await graphOps.updateNodeVerification(
            payload.id || event.aggregateId,
            payload.status || (event.eventType === 'FACT_VERIFIED' ? 'USER_VERIFIED' : 'UNVERIFIED')
          );
          break;
        }

        case 'MEMORY_CREATED': {
          await graphOps.recordMemory({
            id: payload.id || event.aggregateId,
            candidateId: payload.candidateId || payload.userId,
            memoryType: payload.memoryType,
            title: payload.title,
            content: payload.content,
            source: payload.source || 'USER_VERIFIED',
            verificationStatus: payload.verificationStatus || 'USER_VERIFIED',
            expiresAt: payload.expiresAt,
            tenantId: payload.candidateId || payload.userId,
          });
          break;
        }

        case 'RESUME_COMMITTED':
        case 'GRAPH_REBUILD_REQUESTED': {
          const candidateId = payload.candidateId || payload.userId || event.aggregateId;
          await graphOps.rebuildCandidateGraph(candidateId, prisma);

          if (event.eventType === 'RESUME_COMMITTED') {
            await graphOps.recordMemory({
              candidateId,
              memoryType: 'EPISODIC',
              title: `Resume Parsed & Committed: ${payload.fileName || 'Resume'}`,
              content: `Ingested ${payload.factsCount || 0} candidate facts from resume file ${payload.fileName || ''}.`,
              source: 'RESUME_PARSER',
              verificationStatus: 'USER_VERIFIED',
              tenantId: candidateId,
            });
          }
          break;
        }

        default:
          logger.warn({ eventType: event.eventType }, 'Unknown outbox event type, marking as PROCESSED');
      }

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          error: null,
        },
      });

      return true;
    } catch (err: any) {
      logger.error({ eventId: event.id, err: err.message }, 'Failed to project outbox event');
      const attempts = event.attempts + 1;
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts,
          error: err.message || 'Unknown projection error',
          status: attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        },
      });
      return false;
    }
  }

  /**
   * Sweeps pending outbox events and projects them.
   */
  async sweepPending(batchSize = 25): Promise<number> {
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let successCount = 0;
    for (const evt of pendingEvents) {
      const ok = await this.projectEvent(evt.id);
      if (ok) successCount++;
    }

    return successCount;
  }
}

export const outboxService = new OutboxService();
