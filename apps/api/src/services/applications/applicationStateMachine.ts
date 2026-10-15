import crypto from 'crypto';
import { prisma, graphOps } from '@careergraph/db';
import type { WorkflowStatus, ApplicationStage } from '@careergraph/shared';

export interface TransitionContext {
  applicationId: string;
  fromStatus?: string;
  toStatus: WorkflowStatus;
  toStage?: ApplicationStage;
  actorType?: 'USER' | 'AGENT' | 'SYSTEM' | 'CANDIDATE';
  actorId?: string;
  title: string;
  description?: string;
  submissionConfirmationId?: string;
  metadata?: any;
}

/**
 * Permitted status transitions graph per Spec §13.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SAVED: ['QUEUED', 'JOB_VALIDATED', 'CANCELLED'],
  QUEUED: ['JOB_VALIDATED', 'FAILED', 'CANCELLED'],
  JOB_VALIDATED: ['PROFILE_MATCHED', 'FAILED', 'CANCELLED'],
  PROFILE_MATCHED: ['APPLICATION_PREPARED', 'FAILED', 'CANCELLED'],
  APPLICATION_PREPARED: ['WAITING_FOR_USER', 'AWAITING_APPROVAL', 'READY_TO_SUBMIT', 'CANCELLED'],
  WAITING_FOR_USER: ['APPLICATION_PREPARED', 'AWAITING_APPROVAL', 'CANCELLED'],
  AWAITING_APPROVAL: ['READY_TO_SUBMIT', 'SUBMITTING', 'SUBMITTED', 'WAITING_FOR_USER', 'APPLICATION_PREPARED', 'NEEDS_INTERVENTION', 'CANCELLED'],
  READY_TO_SUBMIT: ['SUBMITTING', 'SUBMITTED', 'NEEDS_INTERVENTION', 'CANCELLED'],
  SUBMITTING: ['SUBMITTED', 'SUBMISSION_UNCERTAIN', 'FAILED', 'NEEDS_INTERVENTION'],
  SUBMISSION_UNCERTAIN: ['SUBMITTED', 'FAILED', 'NEEDS_INTERVENTION', 'CANCELLED'],
  FAILED: ['QUEUED', 'JOB_VALIDATED', 'CANCELLED'],
  NEEDS_INTERVENTION: ['APPLICATION_PREPARED', 'AWAITING_APPROVAL', 'READY_TO_SUBMIT', 'SUBMITTED', 'CANCELLED'],
  SUBMITTED: [],
  CANCELLED: ['SAVED'],
};

export class ApplicationStateMachine {
  /**
   * Generates deterministic SHA-256 content hash of the application submission packet.
   * Approval is cryptographically bound to this hash.
   */
  static computeContentHash(payload: {
    jobId: string;
    company: string;
    tailoredResumeId?: string | null;
    coverLetterText?: string | null;
    preparedAnswers?: Record<string, any> | null;
  }): string {
    const canonicalObject = {
      jobId: payload.jobId,
      company: payload.company.trim().toLowerCase(),
      tailoredResumeId: payload.tailoredResumeId || '',
      coverLetterText: (payload.coverLetterText || '').trim(),
      preparedAnswers: Object.keys(payload.preparedAnswers || {})
        .sort()
        .reduce((acc, key) => {
          const item = payload.preparedAnswers![key];
          acc[key] = typeof item === 'object' ? item.answer : String(item);
          return acc;
        }, {} as Record<string, string>),
    };

    const canonicalJson = JSON.stringify(canonicalObject);
    return crypto.createHash('sha256').update(canonicalJson).digest('hex');
  }

  /**
   * Validates whether a state transition is legal.
   */
  static canTransition(from: string, to: string): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Executes a validated state transition, updates application record,
   * generates an immutable ApplicationEvent audit trail, and synchronizes graph memory.
   */
  static async transition(ctx: TransitionContext) {
    const app = await prisma.application.findUnique({
      where: { id: ctx.applicationId },
      include: { job: true, user: true },
    });

    if (!app) {
      throw new Error(`Application ${ctx.applicationId} not found`);
    }

    if (!this.canTransition(app.workflowStatus, ctx.toStatus)) {
      throw new Error(
        `Invalid workflow transition: Cannot move from ${app.workflowStatus} to ${ctx.toStatus}`
      );
    }

    // Determine implied application stage if transitioning to submitted
    let nextStage: ApplicationStage = app.stage;
    if (ctx.toStatus === 'SUBMITTED') {
      nextStage = 'APPLIED';
    } else if (ctx.toStatus === 'APPLICATION_PREPARED' && app.stage === 'SAVED') {
      nextStage = 'PREPARING';
    }

    const updated = await prisma.application.update({
      where: { id: ctx.applicationId },
      data: {
        workflowStatus: ctx.toStatus,
        stage: ctx.toStage || nextStage,
        appliedAt: ctx.toStatus === 'SUBMITTED' ? (app.appliedAt || new Date()) : app.appliedAt,
        submissionConfirmationId:
          ctx.submissionConfirmationId !== undefined
            ? ctx.submissionConfirmationId
            : app.submissionConfirmationId,
        lastActivityAt: new Date(),
      },
    });

    // Record immutable audit event
    await prisma.applicationEvent.create({
      data: {
        applicationId: ctx.applicationId,
        eventType: 'WORKFLOW_TRANSITION',
        fromStatus: app.workflowStatus,
        toStatus: ctx.toStatus,
        actorType: ctx.actorType || 'SYSTEM',
        actorId: ctx.actorId,
        title: ctx.title,
        description: ctx.description,
        metadata: ctx.metadata || {},
      },
    });

    // Sync to FalkorDB episodic memory if submitted or approved
    if (ctx.toStatus === 'SUBMITTED' || ctx.toStatus === 'AWAITING_APPROVAL') {
      await graphOps.recordEpisodicMemory(app.userId, {
        category: 'EPISODIC',
        text: `Application for "${app.job.title}" at ${app.job.company} reached state: ${ctx.toStatus}. Event: ${ctx.title}`,
        context: `WorkflowState_${ctx.toStatus}`,
        verified: true,
      });
    }

    return updated;
  }
}
