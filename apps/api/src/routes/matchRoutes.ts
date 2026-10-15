import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { matchingService } from '../services/matching/matchingService.js';
import {
  MatchScoringWeightsSchema,
  TopMatchesQuerySchema,
} from '@careergraph/shared';
import { z } from 'zod';

export const matchRouter = Router();

matchRouter.use(requireAuth);

/**
 * GET /api/v1/matches/jobs/:jobId
 * Evaluates candidate against a specific job posting deterministically.
 */
matchRouter.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const candidateId = req.user!.userId;
    const jobId = req.params.jobId;

    if (!jobId) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Parameter "jobId" is required.',
      });
    }

    const matchResult = await matchingService.evaluateMatch(candidateId, jobId);
    return res.json({ match: matchResult });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ code: 'NOT_FOUND', message: err.message });
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/matches/top
 * Returns ranked top matching jobs for the authenticated candidate.
 */
matchRouter.get('/top', async (req: Request, res: Response) => {
  try {
    const candidateId = req.user!.userId;
    const query = TopMatchesQuerySchema.parse(req.query);

    const matches = await matchingService.getTopMatches(candidateId, {
      limit: query.limit,
      excludeEliminated: query.excludeEliminated,
      minScore: query.minScore,
    });

    return res.json({
      matches,
      total: matches.length,
      limit: query.limit,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: err.format(),
      });
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/matches/recalculate
 * Recalculates match evaluation with custom weights.
 */
matchRouter.post('/recalculate', async (req: Request, res: Response) => {
  try {
    const candidateId = req.user!.userId;
    const bodySchema = z.object({
      jobId: z.string().min(1, 'jobId is required'),
      weights: MatchScoringWeightsSchema.partial().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const { jobId, weights } = parsed.data;
    const matchResult = await matchingService.evaluateMatch(candidateId, jobId, weights);

    return res.json({ match: matchResult });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ code: 'NOT_FOUND', message: err.message });
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
