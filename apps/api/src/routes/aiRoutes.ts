import { Router, type Request, type Response } from 'express';
import { CopilotChatRequestSchema } from '@careergraph/shared';
import { requireAuth } from '../middleware/authMiddleware.js';
import { apiGeneralRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { AIService } from '../services/ai/aiService.js';

/**
 * Phase 13 — AI Layer routes.
 * GET  /api/v1/ai/status         → provider/model/fallback info for UI widgets
 * POST /api/v1/ai/copilot        → grounded career copilot (single response)
 * POST /api/v1/ai/copilot/stream → grounded copilot via Server-Sent Events
 */
export const aiRouter = Router();

aiRouter.use(apiGeneralRateLimiter);

/** GET /api/v1/ai/status — public, no auth (powers landing-page AI badge) */
aiRouter.get('/status', (_req: Request, res: Response) => {
  res.json(AIService.getStatus());
});

/** GET /api/v1/ai/copilot — conversation bootstrap context (auth required) */
aiRouter.get('/copilot', requireAuth, async (req: Request, res: Response) => {
  res.json({
    status: AIService.getStatus(),
    suggestions: [
      'What jobs on the platform match my skills best?',
      'How complete is my profile and what should I add next?',
      'Draft talking points for my upcoming interview.',
      'Which applications are stuck waiting on me?',
    ],
  });
});

/** POST /api/v1/ai/copilot — single-shot grounded copilot response */
aiRouter.post('/copilot', requireAuth, async (req: Request, res: Response) => {
  const parsed = CopilotChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid copilot request payload.',
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await AIService.copilotChat(req.user!.userId, parsed.data);
    return res.json(result);
  } catch (err: any) {
    console.error('[AI Routes] Copilot failed:', err.message);
    return res.status(503).json({
      code: 'AI_UNAVAILABLE',
      message: 'The AI copilot is temporarily unavailable. Please retry shortly.',
    });
  }
});

/** POST /api/v1/ai/copilot/stream — Server-Sent Events streaming copilot */
aiRouter.post('/copilot/stream', requireAuth, async (req: Request, res: Response) => {
  const parsed = CopilotChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid copilot request payload.',
      details: parsed.error.flatten(),
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    for await (const event of AIService.copilotChatStream(req.user!.userId, parsed.data)) {
      if (event.delta !== undefined) {
        res.write(`event: delta\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
      }
      if (event.mode) {
        res.write(`event: done\ndata: ${JSON.stringify({ mode: event.mode, model: event.model })}\n\n`);
      }
    }
  } catch (err: any) {
    console.error('[AI Routes] Copilot stream failed:', err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream interrupted.' })}\n\n`);
  } finally {
    res.end();
  }
});
