import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AutofillPayloadService } from '../services/automation/autofillPayloadService.js';
import { PlaywrightAutomationService } from '../services/automation/playwrightAutomationService.js';
import { ProceduralMemoryService } from '../services/automation/proceduralMemoryService.js';
import { ApplicationStateMachine } from '../services/applications/applicationStateMachine.js';
import { prisma } from '@careergraph/db';
import {
  PlaywrightSubmissionSchema,
  AutomationReportResultSchema,
  RecordProceduralMemorySchema,
} from '@careergraph/shared';

export const automationRouter = Router();

automationRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/automation/payload/:applicationId
 * Returns grounded autofill payload with verified answers and content-hash for extension.
 */
automationRouter.get('/payload/:applicationId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const currentUrl = typeof req.query.currentUrl === 'string' ? req.query.currentUrl : undefined;

    const payload = await AutofillPayloadService.getAutofillPayload(
      userId,
      req.params.applicationId,
      currentUrl
    );

    res.json({ payload });
  } catch (err: any) {
    res.status(err.message === 'Application not found' ? 404 : 400).json({
      error: err.message,
    });
  }
});

/**
 * POST /api/v1/automation/playwright-submit
 * Triggers headless server-side Playwright submission with safety circuit breakers.
 */
automationRouter.post('/playwright-submit', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = PlaywrightSubmissionSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parse.error.issues,
      });
    }

    const result = await PlaywrightAutomationService.executeSubmission(userId, parse.data);
    res.json({ result });
  } catch (err: any) {
    if (err.message.includes('already in progress')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/automation/report-result
 * Browser extension reports submission outcome or user intervention requirements back to state machine.
 */
automationRouter.post('/report-result', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = AutomationReportResultSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parse.error.issues,
      });
    }

    const input = parse.data;
    const app = await prisma.application.findUnique({
      where: { id: input.applicationId },
      include: { job: true },
    });

    if (!app || app.userId !== userId) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Record learned selectors to procedural memory if provided
    if (input.learnedSelectors && Object.keys(input.learnedSelectors).length > 0) {
      const targetUrl = input.confirmationUrl || app.job.applyUrl || app.job.jobUrl;
      await ProceduralMemoryService.recordLearnedSelectors(
        userId,
        targetUrl,
        input.learnedSelectors
      ).catch(() => {});
    }

    let updated;
    if (input.status === 'SUBMITTED') {
      const confirmationId =
        input.confirmationId ||
        `CG-EXT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      updated = await ApplicationStateMachine.transition({
        applicationId: app.id,
        toStatus: 'SUBMITTED',
        toStage: 'APPLIED',
        actorType: 'CANDIDATE',
        actorId: userId,
        title: 'Application Submitted via Assisted Apply Extension',
        description: `Candidate submitted application via browser extension. Confirmation: ${confirmationId}. Target: ${app.job.company}`,
        submissionConfirmationId: confirmationId,
        metadata: {
          channel: input.channel,
          confirmationUrl: input.confirmationUrl,
          notes: input.notes,
        },
      });
    } else if (input.status === 'NEEDS_INTERVENTION') {
      updated = await prisma.application.update({
        where: { id: app.id },
        data: {
          workflowStatus: 'NEEDS_INTERVENTION',
          lastActivityAt: new Date(),
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: 'INTERVENTION_REQUIRED',
          fromStatus: app.workflowStatus,
          toStatus: 'NEEDS_INTERVENTION',
          actorType: 'CANDIDATE',
          actorId: userId,
          title: 'Manual Intervention Required',
          description: input.interventionReason || 'User intervention required on application form.',
          metadata: {
            channel: input.channel,
            notes: input.notes,
          },
        },
      });
    } else if (input.status === 'SUBMISSION_UNCERTAIN') {
      // Per spec: Never blindly retry uncertain submissions
      updated = await prisma.application.update({
        where: { id: app.id },
        data: {
          workflowStatus: 'SUBMISSION_UNCERTAIN',
          lastActivityAt: new Date(),
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: 'SUBMISSION_UNCERTAIN',
          fromStatus: app.workflowStatus,
          toStatus: 'SUBMISSION_UNCERTAIN',
          actorType: 'CANDIDATE',
          title: 'Submission Uncertain',
          description: 'Submission outcome unclear. Awaiting confirmation.',
          metadata: {
            notes: input.notes,
          },
        },
      });
    } else {
      updated = await prisma.application.update({
        where: { id: app.id },
        data: {
          workflowStatus: input.status,
          lastActivityAt: new Date(),
        },
      });
    }

    res.json({
      application: updated,
      message: `Reported status ${input.status} successfully`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/automation/procedural-memory/:domain
 * Retrieves learned selectors for domain from procedural memory.
 */
automationRouter.get('/procedural-memory/:domain', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const selectors = await ProceduralMemoryService.getSelectorsForDomain(
      userId,
      req.params.domain
    );
    res.json({ domain: req.params.domain, selectors });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/automation/procedural-memory
 * Saves learned selectors into procedural memory.
 */
automationRouter.post('/procedural-memory', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = RecordProceduralMemorySchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parse.error.issues,
      });
    }

    const memory = await ProceduralMemoryService.recordLearnedSelectors(
      userId,
      parse.data.domain,
      parse.data.selectors
    );

    res.json({ memory });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
