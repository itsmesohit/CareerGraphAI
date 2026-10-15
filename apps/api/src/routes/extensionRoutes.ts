import { Router, type Request, type Response } from 'express';
import {
  ExtensionLoginSchema,
  ExtensionJobCaptureSchema,
} from '@careergraph/shared';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimiter, apiGeneralRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { ExtensionService } from '../services/extension/extensionService.js';

/**
 * Phase 14 — Chrome Extension API (consumed by the MV3 background worker).
 * POST /api/v1/extension/auth/login   → 7-day extension session token
 * GET  /api/v1/extension/me            → popup summary card
 * POST /api/v1/extension/jobs/capture  → capture job posting from active tab
 */
export const extensionRouter = Router();

/** POST /api/v1/extension/auth/login */
extensionRouter.post('/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  const parsed = ExtensionLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid extension login payload.',
      details: parsed.error.flatten(),
    });
  }

  try {
    const session = await ExtensionService.login(parsed.data, req.ip);
    return res.json(session);
  } catch (err: any) {
    return res.status(401).json({
      code: 'EXTENSION_LOGIN_FAILED',
      message: err.message || 'Invalid email or password.',
    });
  }
});

/** GET /api/v1/extension/me — popup summary (auth via long-lived token) */
extensionRouter.get('/me', requireAuth, apiGeneralRateLimiter, async (req: Request, res: Response) => {
  try {
    const account = await ExtensionService.getAccount(req.user!.userId);
    return res.json(account);
  } catch (err: any) {
    return res.status(404).json({ code: 'NOT_FOUND', message: err.message });
  }
});

/** POST /api/v1/extension/jobs/capture — capture the current tab's job posting */
extensionRouter.post(
  '/jobs/capture',
  requireAuth,
  apiGeneralRateLimiter,
  async (req: Request, res: Response) => {
    const parsed = ExtensionJobCaptureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid job capture payload.',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await ExtensionService.captureJob(req.user!.userId, parsed.data);
      return res.status(result.isNew ? 201 : 200).json(result);
    } catch (err: any) {
      console.error('[Extension Routes] Capture failed:', err.message);
      return res.status(422).json({
        code: 'CAPTURE_FAILED',
        message: err.message || 'Could not parse this page as a job posting.',
      });
    }
  }
);
