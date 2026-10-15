import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { InboundEmailClassifierService } from '../services/inbound/inboundEmailClassifierService.js';
import {
  ClassifyInboundEmailSchema,
  ResolveInboundEmailSchema,
} from '@careergraph/shared';

export const inboundEmailRouter = Router();
inboundEmailRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/inbound-emails
 * Lists all classified inbound emails for candidate.
 */
inboundEmailRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const events = await InboundEmailClassifierService.listEvents(userId);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inbound-emails/classify
 * Ingests inbound email, classifies category, correlates with application, and optionally auto-applies status.
 */
inboundEmailRouter.post('/classify', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = ClassifyInboundEmailSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const autoApply = req.query.autoApply === 'true' || req.body.autoApply === true;
    const event = await InboundEmailClassifierService.processInboundEmail(userId, parse.data, autoApply);
    res.status(201).json({ event });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inbound-emails/:id/resolve
 * Resolves classified email and optionally applies the suggested status transition.
 */
inboundEmailRouter.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = ResolveInboundEmailSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const resolved = await InboundEmailClassifierService.resolveEvent(userId, req.params.id, parse.data);
    res.json({ event: resolved, message: 'Inbound email event resolved successfully' });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});
