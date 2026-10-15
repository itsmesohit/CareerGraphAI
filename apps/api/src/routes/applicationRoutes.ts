import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { ApplicationTrackerService } from '../services/applications/applicationTrackerService.js';
import { OrchestratorService } from '../services/applications/orchestratorService.js';
import {
  CreateApplicationSchema,
  UpdateApplicationStageSchema,
  AddInterviewScheduleSchema,
  AddApplicationNoteSchema,
} from '@careergraph/shared';

export const applicationRouter = Router();

// All application endpoints require user session
applicationRouter.use(requireAuth);

/**
 * GET /api/v1/applications
 * Lists applications for Kanban, Table, and Calendar views.
 */
applicationRouter.get('/', async (req, res, next) => {
  try {
    const stage = req.query.stage as any;
    const search = req.query.q as string | undefined;

    const applications = await ApplicationTrackerService.listApplications(req.user!.userId, {
      stage,
      search,
    });

    res.json({ applications, total: applications.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications
 * Initializes an application or saves job to pipeline.
 */
applicationRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CreateApplicationSchema.parse(req.body);

    const app = await OrchestratorService.prepareApplication(
      req.user!.userId,
      parsed.jobId,
      parsed.mode,
      parsed.notes
    );

    res.status(201).json({ application: app });
  } catch (err) {
    console.error('[applicationRouter POST / error]:', err);
    next(err);
  }
});

/**
 * GET /api/v1/applications/:id
 * Fetches complete application detail with audit events, interview schedules, and packet.
 */
applicationRouter.get('/:id', async (req, res, next) => {
  try {
    const detail = await ApplicationTrackerService.getApplicationDetail(
      req.user!.userId,
      req.params.id
    );

    res.json({ application: detail });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/applications/:id/stage
 * Updates pipeline stage (Kanban drag-and-drop or manual status transition).
 */
applicationRouter.patch('/:id/stage', async (req, res, next) => {
  try {
    const parsed = UpdateApplicationStageSchema.parse(req.body);

    const updated = await ApplicationTrackerService.updateStage(
      req.user!.userId,
      req.params.id,
      parsed.stage,
      parsed.rejectionReason,
      parsed.notes
    );

    res.json({ application: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/:id/prepare
 * Triggers orchestrator to tailor resume, cover letter, and evaluate questions.
 */
applicationRouter.post('/:id/prepare', async (req, res, next) => {
  try {
    const existing = await ApplicationTrackerService.getApplicationDetail(
      req.user!.userId,
      req.params.id
    );

    const app = await OrchestratorService.prepareApplication(
      req.user!.userId,
      existing.jobId,
      existing.mode as any
    );

    res.json({ application: app });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/applications/:id/packet
 * Generates copyable manual application packet (Spec §13 channel E).
 */
applicationRouter.get('/:id/packet', async (req, res, next) => {
  try {
    const packet = await ApplicationTrackerService.generateManualPacket(
      req.user!.userId,
      req.params.id
    );

    res.json({ packet });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/:id/interviews
 * Schedules an interview round.
 */
applicationRouter.post('/:id/interviews', async (req, res, next) => {
  try {
    const parsed = AddInterviewScheduleSchema.parse(req.body);

    const interview = await ApplicationTrackerService.addInterviewSchedule(
      req.user!.userId,
      req.params.id,
      parsed
    );

    res.status(201).json({ interview });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/:id/notes
 * Adds notes or recruiter contact information.
 */
applicationRouter.post('/:id/notes', async (req, res, next) => {
  try {
    const parsed = AddApplicationNoteSchema.parse(req.body);

    const updated = await ApplicationTrackerService.addNote(
      req.user!.userId,
      req.params.id,
      parsed.notes
    );

    res.json({ application: updated });
  } catch (err) {
    next(err);
  }
});
