import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { MissingInfoService } from '../services/applications/missingInfoService.js';
import { ResolveMissingInfoSchema } from '@careergraph/shared';

export const missingInfoRouter = Router();

// All missing-info endpoints require authentication
missingInfoRouter.use(requireAuth);

/**
 * GET /api/v1/missing-info
 * Lists pending missing information requests for the candidate.
 */
missingInfoRouter.get('/', async (req, res, next) => {
  try {
    const items = await MissingInfoService.listMissingItems(req.user!.userId);
    res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/missing-info/:id/resolve
 * Resolves a missing question with scoped answer storage and unblocks application.
 */
missingInfoRouter.post('/:id/resolve', async (req, res, next) => {
  try {
    const parsed = ResolveMissingInfoSchema.parse(req.body);

    const resolved = await MissingInfoService.resolveMissingItem(
      req.user!.userId,
      req.params.id,
      parsed.candidateAnswer,
      parsed.answerScope as any
    );

    res.json({ item: resolved, message: 'Question resolved and workflow resumed' });
  } catch (err) {
    console.error('[missingInfoRouter POST /:id/resolve error]:', err);
    next(err);
  }
});

/**
 * POST /api/v1/missing-info/:id/skip
 * Skips a missing information item.
 */
missingInfoRouter.post('/:id/skip', async (req, res, next) => {
  try {
    const skipped = await MissingInfoService.skipMissingItem(
      req.user!.userId,
      req.params.id
    );

    res.json({ item: skipped, message: 'Question skipped' });
  } catch (err) {
    next(err);
  }
});
