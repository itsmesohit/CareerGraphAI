import { prisma, graphOps, OutboxStatus, OutboxEvent } from '@careergraph/db';
import pino from 'pino';

const logger = pino({
  name: 'careergraph-graph-projector',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

/**
 * Projects a single OutboxEvent into FalkorDB or the fallback in-memory graph engine.
 * Idempotent: repeated projections of the same event with MERGE Cypher patterns do not duplicate nodes/edges.
 */
export async function projectOutboxEvent(event: OutboxEvent): Promise<boolean> {
  const payload: any = event.payload;

  try {
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

      case 'JOB_INGESTED':
      case 'JOB_UPDATED': {
        await graphOps.projectJob({
          id: payload.id || event.aggregateId,
          company: payload.company,
          title: payload.title,
          location: payload.location,
          url: payload.url,
          salary: payload.salary,
          requirements: payload.requirements || [],
        });
        break;
      }

      default:
        logger.warn({ eventType: event.eventType }, 'Unrecognized event type, passing through');
    }

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: OutboxStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });

    logger.info({ eventId: event.id, eventType: event.eventType }, 'Successfully projected outbox event to graph');
    return true;
  } catch (err: any) {
    logger.error({ eventId: event.id, err: err.message }, 'Failed to project event into graph');
    const attempts = event.attempts + 1;
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        error: err.message || 'Projection error',
        status: attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
      },
    });
    return false;
  }
}
