import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { profileService } from '../services/profileService.js';
import { OnboardingStateUpdateSchema } from '@careergraph/shared';

export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

/**
 * GET /api/v1/onboarding/state
 * Retrieve current resumable onboarding state
 */
onboardingRouter.get('/state', async (req: Request, res: Response) => {
  try {
    const state = await profileService.getOnboardingState(req.user!.userId);
    return res.json({ state });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * PUT /api/v1/onboarding/state
 * Update onboarding progress and current step
 */
onboardingRouter.put('/state', async (req: Request, res: Response) => {
  try {
    const parsed = OnboardingStateUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid onboarding state data',
        details: parsed.error.flatten(),
      });
    }

    const state = await profileService.updateOnboardingState(
      req.user!.userId,
      parsed.data.currentStep,
      parsed.data.isCompleted,
      parsed.data.completedSteps
    );

    return res.json({ state });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
