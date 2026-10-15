import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { OrganizationService } from '../services/organization/organizationService.js';
import { CohortService } from '../services/organization/cohortService.js';
import { InvitationService } from '../services/organization/invitationService.js';
import { ConsentService } from '../services/organization/consentService.js';
import { CampusDriveService } from '../services/organization/campusDriveService.js';
import { PlacementAnalyticsService } from '../services/organization/placementAnalyticsService.js';
import {
  CreateOrganizationInputSchema,
  UpdateOrganizationPolicyInputSchema,
  CreateCohortInputSchema,
  BulkCsvInvitationInputSchema,
  UpdateStudentConsentInputSchema,
  CreateCampusDriveInputSchema,
} from '@careergraph/shared';

export const organizationRouter = Router();
organizationRouter.use(requireAuth);

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/organizations
 * Lists all organizations the authenticated user belongs to.
 */
organizationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const organizations = await OrganizationService.listUserOrganizations(userId);
    res.json({ organizations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations
 * Creates a new organization with the user as ORG_OWNER.
 */
organizationRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = CreateOrganizationInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const organization = await OrganizationService.createOrganization(userId, parse.data);
    res.status(201).json({ organization });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/invitations/accept
 * Accepts an invitation token and links the user.
 */
organizationRouter.post('/invitations/accept', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Invitation token is required' });
      return;
    }

    const result = await InvitationService.acceptInvitation(token, userId);
    res.json({ result, message: 'Successfully joined organization.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id
 * Fetches organization details.
 */
organizationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const organization = await OrganizationService.getOrganization(req.params.id);
    res.json({ organization });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/organizations/:id/policy
 * Updates policies (max apps/day, default mode, allowed/blocked companies).
 */
organizationRouter.patch('/:id/policy', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = UpdateOrganizationPolicyInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const organization = await OrganizationService.updateOrganizationPolicy(
      req.params.id,
      parse.data,
      userId
    );
    res.json({ organization });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/members
 * Lists members (students, mentors, admins) with cohorts and consent status.
 */
organizationRouter.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const members = await OrganizationService.listMembers(req.params.id, {
      role: req.query.role as any,
      cohortId: req.query.cohortId as string,
    });
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/organizations/:id/members/:userId
 * Removes a member and reclaims the seat.
 */
organizationRouter.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const actorUserId = getUserId(req);
    await OrganizationService.removeMember(req.params.id, req.params.userId, actorUserId);
    res.json({ success: true, message: 'Member removed and seat reclaimed.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/cohorts
 * Lists all cohorts for the organization.
 */
organizationRouter.get('/:id/cohorts', async (req: Request, res: Response) => {
  try {
    const cohorts = await CohortService.listCohorts(req.params.id);
    res.json({ cohorts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/cohorts
 * Creates a new cohort.
 */
organizationRouter.post('/:id/cohorts', async (req: Request, res: Response) => {
  try {
    const parse = CreateCohortInputSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const cohort = await CohortService.createCohort(req.params.id, parse.data);
    res.status(201).json({ cohort });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/cohorts/:cohortId/students
 * Adds student to a cohort.
 */
organizationRouter.post('/:id/cohorts/:cohortId/students', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    await CohortService.addStudentToCohort(req.params.cohortId, userId);
    res.json({ success: true, message: 'Student added to cohort.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/organizations/:id/cohorts/:cohortId/students/:userId
 * Removes student from a cohort.
 */
organizationRouter.delete('/:id/cohorts/:cohortId/students/:userId', async (req: Request, res: Response) => {
  try {
    await CohortService.removeStudentFromCohort(req.params.cohortId, req.params.userId);
    res.json({ success: true, message: 'Student removed from cohort.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/invitations
 * Lists pending invitations.
 */
organizationRouter.get('/:id/invitations', async (req: Request, res: Response) => {
  try {
    const invitations = await InvitationService.listInvitations(req.params.id, req.query.status as string);
    res.json({ invitations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/invitations
 * Creates single invitation.
 */
organizationRouter.post('/:id/invitations', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { email, name, role, cohortId } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const invitation = await InvitationService.createInvitation({
      orgId: req.params.id,
      email,
      name,
      role,
      cohortId,
      invitedByUserId: userId,
    });

    res.status(201).json({ invitation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/invitations/bulk-csv
 * Bulk CSV invitations with dry-run support.
 */
organizationRouter.post('/:id/invitations/bulk-csv', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = BulkCsvInvitationInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const report = await InvitationService.processBulkCsv(req.params.id, parse.data, userId);
    res.json({ report });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/organizations/:id/invitations/:inviteId
 * Revokes invitation.
 */
organizationRouter.delete('/:id/invitations/:inviteId', async (req: Request, res: Response) => {
  try {
    await InvitationService.revokeInvitation(req.params.inviteId, req.params.id);
    res.json({ success: true, message: 'Invitation revoked.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/consent
 * Gets current student's privacy toggles.
 */
organizationRouter.get('/:id/consent', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const consent = await ConsentService.getConsent(req.params.id, userId);
    res.json({ consent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/organizations/:id/consent
 * Updates student's privacy toggles.
 */
organizationRouter.patch('/:id/consent', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = UpdateStudentConsentInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const consent = await ConsentService.updateConsent(req.params.id, userId, parse.data);
    res.json({ consent, message: 'Privacy toggles updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/drives
 * Lists active campus drives.
 */
organizationRouter.get('/:id/drives', async (req: Request, res: Response) => {
  try {
    const drives = await CampusDriveService.listDrives(req.params.id, req.query.cohortId as string);
    res.json({ drives });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/drives
 * Creates a new campus placement drive.
 */
organizationRouter.post('/:id/drives', async (req: Request, res: Response) => {
  try {
    const parse = CreateCampusDriveInputSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const drive = await CampusDriveService.createDrive(req.params.id, parse.data);
    res.status(201).json({ drive });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/drives/:driveId
 * Details of single drive.
 */
organizationRouter.get('/:id/drives/:driveId', async (req: Request, res: Response) => {
  try {
    const drive = await CampusDriveService.getDrive(req.params.driveId);
    const applicants = await CampusDriveService.listDriveApplicants(req.params.driveId);
    res.json({ drive, applicants });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * POST /api/v1/organizations/:id/drives/:driveId/apply
 * Candidate applies to campus drive.
 */
organizationRouter.post('/:id/drives/:driveId/apply', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { resumeUrl, notes } = req.body;
    await CampusDriveService.applyToDrive(req.params.driveId, userId, resumeUrl, notes);
    res.json({ success: true, message: 'Application submitted for campus drive.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/organizations/:id/drives/:driveId/applicants/:userId
 * Updates applicant status.
 */
organizationRouter.patch('/:id/drives/:driveId/applicants/:userId', async (req: Request, res: Response) => {
  try {
    const { status, offeredCtc } = req.body;
    await CampusDriveService.updateApplicationStatus(
      req.params.driveId,
      req.params.userId,
      status,
      offeredCtc
    );
    res.json({ success: true, message: 'Applicant status updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/cohorts/:cohortId/analytics
 * Placement cell cohort analytics.
 */
organizationRouter.get('/:id/cohorts/:cohortId/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await PlacementAnalyticsService.getCohortAnalytics(
      req.params.cohortId,
      req.params.id
    );
    res.json({ analytics });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/organizations/:id/cohorts/:cohortId/analytics/export
 * Downloads CSV placement accreditation report.
 */
organizationRouter.get('/:id/cohorts/:cohortId/analytics/export', async (req: Request, res: Response) => {
  try {
    const csv = await PlacementAnalyticsService.exportPlacementReportCsv(
      req.params.cohortId,
      req.params.id
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Placement_Report_Cohort_${req.params.cohortId}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
