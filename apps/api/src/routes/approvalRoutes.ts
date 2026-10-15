import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { ApprovalCenterService } from '../services/applications/approvalCenterService.js';
import { ApproveApplicationSchema, BulkApproveSchema } from '@careergraph/shared';

export const approvalRouter = Router();

// All approval endpoints require candidate authentication
approvalRouter.use(requireAuth);

/**
 * GET /api/v1/approvals
 * Lists all applications awaiting approval.
 */
approvalRouter.get('/', async (req, res, next) => {
  try {
    const approvals = await ApprovalCenterService.listPendingApprovals(req.user!.userId);
    res.json({ approvals, total: approvals.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/approvals/:id/approve
 * Approves an application with cryptographic content-hash validation.
 */
approvalRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const parsed = ApproveApplicationSchema.parse(req.body);

    const approved = await ApprovalCenterService.approveApplication(
      req.user!.userId,
      req.params.id,
      parsed.contentHash,
      parsed.submissionChannel as any,
      parsed.coverLetterText
    );

    res.json({
      application: approved,
      message: 'Application approved and submitted successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/approvals/:id/reject
 * Rejects or cancels an application draft.
 */
approvalRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const reason = req.body.reason as string | undefined;

    const rejected = await ApprovalCenterService.rejectApplication(
      req.user!.userId,
      req.params.id,
      reason
    );

    res.json({ application: rejected, message: 'Application rejected' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/approvals/bulk-approve
 * Bulk approves multiple applications with per-item content-hash validation.
 */
approvalRouter.post('/bulk-approve', async (req, res, next) => {
  try {
    const parsed = BulkApproveSchema.parse(req.body);

    const results = await ApprovalCenterService.bulkApprove(
      req.user!.userId,
      parsed.approvals
    );

    res.json({ results });
  } catch (err) {
    next(err);
  }
});
