import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { complianceService } from '../services/compliance/complianceService.js';
import { AccountErasureInputSchema } from '@careergraph/shared';

export const complianceRouter = Router();

complianceRouter.use(requireAuth);

/**
 * GET /api/v1/compliance/export-data
 * Full Data Portability JSON export (DPDP Act 2023 & GDPR Art 20)
 */
complianceRouter.get('/export-data', async (req: Request, res: Response) => {
  try {
    const archive = await complianceService.exportUserData(req.user!.userId, req);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="careergraph_data_export_${req.user!.userId.slice(0, 8)}.json"`
    );
    res.json(archive);
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/compliance/delete-account
 * Right to Erasure / Right to be Forgotten (DPDP Act 2023 & GDPR Art 17)
 */
complianceRouter.post('/delete-account', async (req: Request, res: Response) => {
  try {
    const parse = AccountErasureInputSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parse.error.errors });
    }

    const result = await complianceService.eraseUserAccount(
      req.user!.userId,
      parse.data.confirmationPhrase,
      req.user!.userId,
      req
    );

    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ code: 'ERASURE_FAILED', message: err.message });
  }
});
