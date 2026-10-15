import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { RecruiterOutreachService } from '../services/outreach/recruiterOutreachService.js';
import {
  GenerateOutreachDraftSchema,
  UpdateOutreachDraftSchema,
  ApproveOutreachDraftSchema,
  SendOutreachDraftSchema,
} from '@careergraph/shared';

export const outreachRouter = Router();
outreachRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/outreach/quota
 * Returns candidate's daily outreach send quota and remaining balance.
 */
outreachRouter.get('/quota', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const quota = await RecruiterOutreachService.getDailyQuota(userId);
    res.json({ quota });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/outreach
 * Lists recruiter outreach drafts and sent emails for candidate.
 */
outreachRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const outreach = await RecruiterOutreachService.listOutreach(userId);
    res.json({ outreach });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/outreach/draft
 * Generates recruiter outreach draft grounded in candidate's verified graph facts.
 */
outreachRouter.post('/draft', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = GenerateOutreachDraftSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const draft = await RecruiterOutreachService.createDraft(userId, parse.data);
    res.status(201).json({ draft });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/outreach/:id
 * Updates draft content. Edits strictly invalidate prior approval per Spec §16.
 */
outreachRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = UpdateOutreachDraftSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const updated = await RecruiterOutreachService.updateDraft(userId, req.params.id, parse.data);
    res.json({ draft: updated });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/outreach/:id/approve
 * Locks and approves the draft against its cryptographic contentHash.
 */
outreachRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = ApproveOutreachDraftSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const approved = await RecruiterOutreachService.approveDraft(
      userId,
      req.params.id,
      parse.data.contentHash
    );
    res.json({ draft: approved, message: 'Outreach approved and locked for dispatch' });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/outreach/:id/send
 * Dispatches the approved outreach email. Fails if not approved or if hash tampered.
 */
outreachRouter.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = SendOutreachDraftSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const sent = await RecruiterOutreachService.sendDraft(
      userId,
      req.params.id,
      parse.data.contentHash,
      parse.data.provider
    );
    res.json({ draft: sent, message: 'Outreach email successfully dispatched' });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});
