import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { IntegrationOAuthService } from '../services/integrations/integrationOAuthService.js';
import {
  InitiateOAuthSchema,
  ConnectManualIntegrationSchema,
} from '@careergraph/shared';
import { IntegrationProvider } from '@careergraph/db';

export const integrationsRouter = Router();
integrationsRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/integrations
 * Lists all connected integrations for candidate.
 */
integrationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const integrations = await IntegrationOAuthService.listIntegrations(userId);
    res.json({ integrations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/integrations/oauth/:provider/authorize
 * Returns OAuth authorization URL with minimal scopes per Spec §16.
 */
integrationsRouter.get('/oauth/:provider/authorize', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const provider = req.params.provider.toUpperCase() as IntegrationProvider;

    const parse = InitiateOAuthSchema.safeParse({
      provider,
      redirectUri: typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
    });

    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid provider or redirect URI', details: parse.error.issues });
    }

    const result = IntegrationOAuthService.getAuthorizeUrl(userId, provider, parse.data.redirectUri);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/integrations/connect
 * Connects integration with envelope-encrypted tokens.
 */
integrationsRouter.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = ConnectManualIntegrationSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.issues });
    }

    const integration = await IntegrationOAuthService.connectIntegration(userId, parse.data);
    res.status(201).json({ integration });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/integrations/:id
 * Disconnects integration and permanently deletes tokens.
 */
integrationsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    await IntegrationOAuthService.disconnectIntegration(userId, req.params.id);
    res.json({ message: 'Integration disconnected and credentials purged successfully' });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});
