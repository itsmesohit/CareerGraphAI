import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { adminService } from '../services/admin/adminService.js';
import { auditService } from '../services/admin/auditService.js';
import { promptInjectionService } from '../services/security/promptInjectionService.js';
import {
  UpdateUserRoleInputSchema,
  SuspendUserInputSchema,
  UpdateOrgSeatsInputSchema,
  AuditLogQueryInputSchema,
} from '@careergraph/shared';

export const adminRouter = Router();

// Super-admin only gate for all administrative endpoints
adminRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

/**
 * GET /api/v1/admin/stats
 * Aggregates platform statistics for super-admin dashboard
 */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await adminService.getPlatformStats();
    res.json({ data: stats });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/admin/users
 * Lists and searches users
 */
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string | undefined;
    const role = req.query.role as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await adminService.listUsers({ query, role, page, limit });
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * PATCH /api/v1/admin/users/:id/role
 * Updates user role
 */
adminRouter.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const parse = UpdateUserRoleInputSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parse.error.errors });
    }

    const updatedUser = await adminService.updateUserRole(
      req.params.id,
      parse.data.role,
      req.user!.userId,
      req
    );

    res.json({ data: { user: updatedUser, message: 'User role updated successfully' } });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * PATCH /api/v1/admin/users/:id/suspend
 * Suspends or reactivates user
 */
adminRouter.patch('/users/:id/suspend', async (req: Request, res: Response) => {
  try {
    const parse = SuspendUserInputSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parse.error.errors });
    }

    const updatedUser = await adminService.suspendUser(
      req.params.id,
      parse.data.isSuspended,
      parse.data.reason,
      req.user!.userId,
      req
    );

    res.json({ data: { user: updatedUser, message: 'User status updated successfully' } });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * DELETE /api/v1/admin/users/:id/sessions
 * Force terminates all active sessions for a user
 */
adminRouter.delete('/users/:id/sessions', async (req: Request, res: Response) => {
  try {
    const result = await adminService.revokeAllUserSessions(req.params.id, req.user!.userId, req);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/admin/organizations
 * Lists all multi-tenant organizations
 */
adminRouter.get('/organizations', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await adminService.listOrganizations({ query, page, limit });
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * PATCH /api/v1/admin/organizations/:id/seats
 * Overrides purchased seats capacity for an organization
 */
adminRouter.patch('/organizations/:id/seats', async (req: Request, res: Response) => {
  try {
    const parse = UpdateOrgSeatsInputSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parse.error.errors });
    }

    const org = await adminService.updateOrgSeats(
      req.params.id,
      parse.data.seatsPurchased,
      req.user!.userId,
      req
    );

    res.json({ data: { organization: org, message: 'Organization seats updated successfully' } });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/admin/audit-logs
 * Queries immutable audit logs with filters
 */
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const parse = AuditLogQueryInputSchema.safeParse({
      action: req.query.action,
      userId: req.query.userId,
      actorId: req.query.actorId,
      resource: req.query.resource,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parse.error.errors });
    }

    const logs = await auditService.queryLogs(parse.data);
    res.json({ data: logs });
  } catch (err: any) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/admin/prompt-injection/test
 * Diagnostic endpoint to test prompt injection heuristics and sanitization
 */
adminRouter.post('/prompt-injection/test', (req: Request, res: Response) => {
  const content = req.body.content || '';
  const origin = req.body.origin || 'admin_test';
  const result = promptInjectionService.sanitizeExternalContent(content, origin);
  res.json({ data: result });
});
