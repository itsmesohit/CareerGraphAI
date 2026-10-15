import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { InterviewService } from '../services/interviews/interviewService.js';
import {
  CreateInterviewScheduleSchema,
  UpdateInterviewScheduleSchema,
} from '@careergraph/shared';

export const interviewRouter = Router();
interviewRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/interviews
 * Lists all scheduled interviews for candidate.
 */
interviewRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const interviews = await InterviewService.listInterviews(userId);
    res.json({ interviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/interviews
 * Schedules an interview round, generates prep questions, and advances application stage.
 */
interviewRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = CreateInterviewScheduleSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const interview = await InterviewService.scheduleInterview(userId, parse.data);
    res.status(201).json({ interview });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/interviews/:id
 * Updates interview status or details.
 */
interviewRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = UpdateInterviewScheduleSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const updated = await InterviewService.updateInterview(userId, req.params.id, parse.data);
    res.json({ interview: updated });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/interviews/:id/ics
 * Generates and downloads RFC 5545 compliant iCalendar (.ics) file per Spec §14.
 */
interviewRouter.get('/:id/ics', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { icsContent, filename } = await InterviewService.generateIcs(userId, req.params.id);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});
