import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { profileService } from '../services/profileService.js';
import { z } from 'zod';
import { CandidateAnswerInputSchema } from '@careergraph/shared';

export const questionRouter = Router();

const AnswerListSchema = z.object({
  answers: z.array(CandidateAnswerInputSchema),
});

/**
 * GET /api/v1/questions
 * Retrieve canonical universal questions (open or core only)
 */
questionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const coreOnly =
      req.query.coreOnly === 'true'
        ? true
        : req.query.coreOnly === 'false'
        ? false
        : undefined;

    const questions = await profileService.getQuestions({ category, coreOnly });
    return res.json({ questions, total: questions.length });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/questions/answers
 * Retrieve answers submitted by the authenticated candidate
 */
questionRouter.get('/answers', requireAuth, async (req: Request, res: Response) => {
  try {
    const answers = await profileService.getAnswers(req.user!.userId);
    return res.json({ answers });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/questions/answers
 * Save or update candidate answers for canonical questions
 */
questionRouter.post('/answers', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = AnswerListSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid answers array',
        details: parsed.error.flatten(),
      });
    }

    const answers = await profileService.saveAnswers(req.user!.userId, parsed.data.answers);
    return res.status(200).json({ answers });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
